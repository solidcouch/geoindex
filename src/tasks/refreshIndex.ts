import {
  ldhop,
  LdhopEngine,
  LdhopQuery,
  MixedVariables,
  run,
  Variable,
} from '@ldhop/core'
import { getAuthenticatedFetch } from '@soid/koa'
import { Parser, Store } from 'n3'
import { rdf, rdfs, sioc, solid, vcard } from 'rdf-namespaces'
import { hospex } from '../namespaces.js'
import { HttpError } from '../utils/errors.js'
import { fetchThing, saveThing, validateThing } from '../utils/thing.js'

const query = ldhop('?person', '?community')
  // Go to person's webId and fetch extended proimage documents, too
  .match('?person', rdfs.seeAlso)
  .o('?extendedDocument')
  .add()
  .match('?person', solid.publicTypeIndex)
  .o('?publicTypeIndex')
  .match(null, rdf.type, solid.TypeRegistration, '?publicTypeIndex')
  .s('?typeRegistration')
  .match('?typeRegistration', solid.forClass, `${hospex}PersonalHospexDocument`)
  .s('?typeRegistrationForHospex')
  .match('?typeRegistrationForHospex', solid.instance)
  .o('?hospexDocument')
  .add()
  .match('?person', sioc.member_of, '?community')
  .g('?hospexDocumentForCommunity')
  .match('?person', `${hospex}offers`)
  .o('?thing')
  .toArray()

const fetchPersonThings = async <V extends Variable>({
  person,
  fetch,
  query,
}: {
  person: string
  fetch: typeof globalThis.fetch
  query: LdhopQuery<'?person' | '?thing' | V>
}) => {
  const engine = new LdhopEngine(query, { person: [person] } as Partial<
    MixedVariables<'?person' | '?thing' | V>
  >)

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
    try {
      const authFetch = await getAuthenticatedFetch(webId)
      const things = await fetchPersonThings({
        person: member,
        fetch: authFetch,
        query,
      })

      for (const term of things) {
        try {
          if (term.termType !== 'NamedNode')
            throw new Error('Thing Term in not a URI')
          const raw = await fetchThing(term.value, authFetch)
          const thing = validateThing(raw, { allowedTypes: thingTypes })
          await saveThing({ ...thing, uri: term.value })
          count++
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(e)
          continue
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
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
