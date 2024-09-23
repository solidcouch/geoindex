import { parseLinkHeader } from '@solid/community-server'
import { expect } from 'chai'
import { createAccount, getAuthenticatedFetch } from 'css-authn/dist/7.x.js'
import ngeohash from 'ngeohash'
import { v4 as uuidv4 } from 'uuid'
import { Thing } from '../../database.js'
import { Person } from './types.js'

export const createRandomAccount = async ({
  solidServer,
}: {
  solidServer: string
}) => {
  const account = await createAccount({
    username: uuidv4(),
    password: uuidv4(),
    email: uuidv4() + '@example.com',
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
 * Find link to ACL document for a given URI
 */
export const getAcl = async (
  uri: string,
  ffetch: typeof globalThis.fetch = globalThis.fetch,
) => {
  const response = await ffetch(uri, { method: 'HEAD' })
  expect(response.ok).to.be.true
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
  }hospex/test/${uuidv4()}#accommodation`

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
