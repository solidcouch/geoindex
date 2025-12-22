import { LdhopEngine, LdhopQuery, run, Variable } from '@ldhop/core'
import { getAuthenticatedFetch } from '@soid/koa'
import { Parser, Store } from 'n3'
import { rdf, sioc, solid, vcard } from 'rdf-namespaces'
import { hospex } from '../namespaces.js'
import { HttpError } from '../utils/errors.js'
import { fetchThing, saveThing, validateThing } from '../utils/thing.js'

const query: LdhopQuery<
  | '?person'
  | '?publicTypeIndex'
  | '?typeRegistration'
  | '?typeRegistrationForHospex'
  | '?hospexDocument'
  | '?community'
  | '?hospexDocumentForCommunity'
  | '?thing'
> = [
  {
    type: 'match',
    subject: '?person',
    predicate: solid.publicTypeIndex,
    pick: 'object',
    target: '?publicTypeIndex',
  },
  {
    type: 'match',
    predicate: rdf.type,
    object: solid.TypeRegistration,
    graph: '?publicTypeIndex',
    pick: 'subject',
    target: '?typeRegistration',
  },
  {
    type: 'match',
    subject: '?typeRegistration',
    predicate: solid.forClass,
    object: `${hospex}PersonalHospexDocument`,
    pick: 'subject',
    target: '?typeRegistrationForHospex',
  },
  {
    type: 'match',
    subject: '?typeRegistrationForHospex',
    predicate: solid.instance,
    pick: 'object',
    target: `?hospexDocument`,
  },
  { type: 'add resources', variable: '?hospexDocument' },
  {
    type: 'match',
    subject: '?person',
    predicate: sioc.member_of,
    object: '?community',
    pick: 'graph',
    target: '?hospexDocumentForCommunity',
  },
  {
    type: 'match',
    subject: '?person',
    predicate: `${hospex}offers`,
    pick: 'object',
    target: '?thing',
  },
]

const fetchPersonThings = async <V extends Variable>({
  person,
  fetch,
  query,
}: {
  person: string
  fetch: typeof globalThis.fetch
  query: LdhopQuery<V | '?person' | '?thing'>
}) => {
  const engine = new LdhopEngine(query, {
    '?person': new Set([person]),
  } as Partial<Record<V | '?person' | '?thing', Set<string>>>)

  await run(engine, fetch)

  return engine.getVariable('?thing')
}

export const refreshIndex = async (
  groups: string[],
  webId: string,
  thingTypes: string[],
) => {
  const members = new Set(
    await fetchGroups(groups, await getAuthenticatedFetch(webId)),
  )

  let count = 0

  for (const member of members) {
    const authFetch = await getAuthenticatedFetch(webId)
    const things = await fetchPersonThings({
      person: member,
      fetch: authFetch,
      query,
    })

    for (const term of things) {
      if (term.termType !== 'NamedNode') return
      const raw = await fetchThing(term.value, authFetch)
      const thing = validateThing(raw, { allowedTypes: thingTypes })
      await saveThing({ ...thing, uri: term.value })
      count++
    }
  }

  // eslint-disable-next-line no-console
  console.log('Index refreshed.', count, 'things saved.')
}

const fetchGroups = async (
  groups: string[],
  fetch: typeof globalThis.fetch,
) => {
  const settled = await Promise.allSettled(
    groups.map(g => fetchGroup(g, fetch)),
  )

  if (!settled.some(a => a.status === 'fulfilled'))
    throw new Error('no group could be fetched')

  const persons = settled
    .filter(p => p.status === 'fulfilled')
    .flatMap(p => p.value)

  return persons
}

const fetchGroup = async (uri: string, fetch: typeof globalThis.fetch) => {
  const response = await fetch(uri)

  if (!response.ok)
    throw new HttpError(`group <${uri}> could not be fetched`, response)

  const rawGroup = await response.text()

  const parser = new Parser({
    format: (response.headers.get('content-type') as string) ?? 'text/turtle',
    baseIRI: uri,
  })

  const quads = parser.parse(rawGroup)
  const store = new Store(quads)
  const members = store.getObjects(uri, vcard.hasMember, null).map(m => m.value)

  return members
}
