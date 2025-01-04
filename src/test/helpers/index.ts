import { parseLinkHeader } from '@solid/community-server'
import { createAccount, getAuthenticatedFetch } from 'css-authn/dist/7.x.js'
import ngeohash from 'ngeohash'
import { randomUUID } from 'node:crypto'
import { foaf, sioc, solid } from 'rdf-namespaces'
import { expect } from 'vitest'
import { Thing } from '../../database.js'
import { hospex } from '../../namespaces.js'
import { createContainer, createResource, patchFile } from './setupPod.js'
import { Person } from './types.js'

export const createRandomAccount = async ({
  solidServer,
}: {
  solidServer: string
}) => {
  const account = await createAccount({
    username: randomUUID(),
    password: randomUUID(),
    email: randomUUID() + '@example.com',
    provider: solidServer,
  })

  const authenticatedFetch = await getAuthenticatedFetch({
    email: account.email,
    password: account.password,
    provider: solidServer,
  })

  return { ...account, fetch: authenticatedFetch }
}

/**
 * Setup hospex document, type index, and accommodations for the given person
 */
export const setupThingsForPerson = async ({
  person,
  group,
  community,
  things: thingCount,
}: {
  person: Person
  group: string
  community: string
  things: number
}) => {
  const accommodations = Array.from({ length: thingCount }, () =>
    generateAccommodationUri(person),
  )
  const hospexContainer = getContainer(generateAccommodationUri(person))
  // create hospex container

  await createContainer({
    url: hospexContainer,
    acls: [
      {
        permissions: ['Read', 'Write', 'Control'],
        agents: [person.webId],
        isDefault: true,
      },
      {
        permissions: ['Read'],
        agentGroups: [group],
        isDefault: true,
      },
    ],
    authenticatedFetch: person.fetch,
  })

  // create accommodations
  for (const accommodationUri of accommodations) {
    const [lat, long] = getRandomLocation()
    const resource = getResource(accommodationUri)
    const fragment = new URL(accommodationUri).hash

    await createResource({
      url: resource,
      body: `
          @prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>.

          <${fragment}>
            a <${hospex + 'Accommodation'}>;
            geo:location <#location>.
          <#location> a geo:Location;
            geo:lat ${lat};
            geo:long ${long}.
        `,
      authenticatedFetch: person.fetch,
    })
  }
  // create personal hospex document with linked accommodations

  const personalHospexDocument = hospexContainer + 'card'

  await createResource({
    url: personalHospexDocument,
    body: `
    @prefix hospex: <${hospex}>.

    <${person.webId}> <${sioc.member_of}> <${community}>;
    ${
      accommodations.length > 0
        ? 'hospex:offers ' + accommodations.map(a => `<${a}>`).join(', ') + ';'
        : ''
    }
    hospex:storage <${hospexContainer}>.

    `,
    authenticatedFetch: person.fetch,
  })
  // create type index referencing the personal hospex document
  const typeIndex = new URL(
    './settings/publicTypeIndex.ttl',
    person.podUrl,
  ).toString()

  await createResource({
    url: typeIndex,
    body: `
    @prefix solid: <http://www.w3.org/ns/solid/terms#>.
    @prefix dct: <http://purl.org/dc/terms/>.
    @prefix hospex: <http://w3id.org/hospex/ns#>.

    <> a solid:TypeIndex, solid:ListedDocument;
      dct:references <#registration>.
    <#registration> a solid:TypeRegistration;
      solid:forClass hospex:PersonalHospexDocument;
      solid:instance <${personalHospexDocument}>.
    `,
    acls: [
      { permissions: ['Read', 'Write', 'Control'], agents: [person.webId] },
      { permissions: ['Read'], agentClasses: [foaf.Agent] },
    ],
    authenticatedFetch: person.fetch,
  })

  // save type index to webId
  await patchFile({
    url: getResource(person.webId),
    inserts: `<${person.webId}> <${solid.publicTypeIndex}> <${typeIndex}>.`,
    authenticatedFetch: person.fetch,
  })
}

/**
 * Find link to ACL document for a given URI
 */
export const getAcl = async (
  uri: string,
  ffetch: typeof globalThis.fetch = globalThis.fetch,
) => {
  const response = await ffetch(uri, { method: 'HEAD' })
  expect(response.ok).toBe(true)
  const linkHeader = response.headers.get('link')
  const links = parseLinkHeader(linkHeader ?? '')
  const aclLink = links.find(link => link.parameters.rel === 'acl')
  const aclUri = aclLink?.target
  if (!aclUri) throw new Error(`We could not find WAC link for ${uri}`)
  // if aclUri is relative, return absolute uri
  return new URL(aclUri, uri).toString()
}

/**
 * Generate accommodation URI for a given person
 */
export const generateAccommodationUri = (person: Pick<Person, 'podUrl'>) =>
  `${person.podUrl}${
    person.podUrl.endsWith('/') ? '' : '/'
  }hospex/test/${randomUUID()}#accommodation`

export const getContainer = (uri: string) =>
  uri.substring(0, uri.lastIndexOf('/') + 1)

export const getResource = (uri: string) => {
  const url = new URL(uri)
  const clearedUrl = new URL(url.pathname, url.origin).toString()
  return clearedUrl
}

export const getDefaultPerson = async (
  {
    email,
    password,
    pods: [{ name }],
  }: {
    email: string
    password: string
    pods: [{ name: string }]
  },
  cssUrl: string,
): Promise<Person> => {
  const podUrl = `${cssUrl}/${name}/`
  const withoutFetch: Omit<Person, 'fetch'> = {
    podUrl,
    idp: cssUrl + '/',
    webId: podUrl + 'profile/card#me',
    username: name,
    password,
    email,
  }
  return {
    ...withoutFetch,
    fetch: await getAuthenticatedFetch({ ...withoutFetch, provider: cssUrl }),
  }
}

const getRandomLocation = (): [number, number] => [
  (Math.random() - 0.5) * 180,
  (Math.random() - 0.5) * 360,
]

/**
 * Save a given amount of things with random URI and geohash to database
 */
export const createRandomThingsInDb = async (amount: number) => {
  const things = Array(amount)
    .fill(null)
    .map((v, i) => ({
      uri: generateAccommodationUri({
        podUrl: `https://example.com/person${i}/`,
      }),
      geohash: ngeohash.encode(...getRandomLocation(), 10),
    }))

  await Thing.bulkCreate(things)
}

export function getRandomPort(): number {
  // Generate a random number between 1024 and 65535
  const min = 1024
  const max = 65535
  return Math.floor(Math.random() * (max - min + 1)) + min
}
