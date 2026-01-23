import ngeohash from 'ngeohash'
import { Op } from 'sequelize'
import { beforeEach, describe, expect, it } from 'vitest'
import { Thing } from '../database.js'
import { hospex } from '../namespaces.js'
import {
  createRandomThingsInDb,
  generateAccommodationUri,
  getContainer,
  getResource,
} from './helpers/index.js'
import { createContainer, createResource } from './helpers/setupPod.js'
import { Account } from './helpers/types.js'
import { appConfig, person, person2 } from './setup.js'

describe("POST /inbox When a person creates, updates, or removes a Thing, they can send a notification to this service's inbox. The service will fetch and save the thing's uri, location and owner, as long as it is a valid thing interesting for this service.", () => {
  // the example accommodation for the given person
  // to avoid repetition
  let accommodation: string
  beforeEach(() => {
    accommodation = generateAccommodationUri(person)
  })

  describe('not authenticated', () => {
    it('should respond with 401', async () => {
      const response = await fetch(`${appConfig.baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Create',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Document',
            id: accommodation,
          },
        }),
      })

      expect(response.status).toBe(401)
    })
  })

  describe('not a group member', () => {
    it('should respond with 403', async () => {
      const response = await person2.fetch(`${appConfig.baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Create',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Document',
            id: generateAccommodationUri(person2),
          },
        }),
      })

      expect(response.status).toBe(403)
    })
  })

  /**
   * Run before tests which assume that thing has not been saved to database
   */
  const beforeNotSaved = async (uri: string) => {
    const thing = await Thing.findOne({ where: { uri } })
    expect(thing).toBeFalsy()
  }

  /**
   * Run this before tests which assume that the thing has been saved to database
   */
  const beforeSaved = async (uri: string) => {
    await Thing.create({ uri, geohash: ngeohash.encode(0, 0, 10) })

    const thing = await Thing.findOne({ where: { uri } })
    expect(thing).toBeDefined()
  }

  /**
   * Run this before tests which assume that the service can't find the thing in the person's pod
   *
   * @param uri
   * @param options.createContainer - if you say true, the hospex container will be created and the bot will receive response 404, otherwise it will receive response 403
   *
   * @returns Promise<void>
   */
  const beforeNotFound = async (
    uri: string,
    options: { createContainer?: boolean } = {},
  ) => {
    const container = getContainer(uri)

    if (options.createContainer)
      await createContainer({
        url: container,
        acls: [
          {
            permissions: ['Read', 'Write', 'Control'],
            agents: [person.webId],
            isDefault: true,
          },
          {
            permissions: ['Read'],
            agentGroups: appConfig.indexedGroups,
            isDefault: true,
          },
        ],
        authenticatedFetch: person.fetch,
      })
  }

  /**
   * Run this before tests which assume that the service can successfully find the thing in the person's pod
   */
  const beforeFound = async (
    uri: string,
    person: Account,
    thing = hospex + 'Accommodation',
  ) => {
    // TODO create an accommodation that the group can read
    const container = getContainer(uri)
    const resource = getResource(uri)
    const fragment = new URL(uri).hash

    await createContainer({
      url: container,
      acls: [
        {
          permissions: ['Read', 'Write', 'Control'],
          agents: [person.webId],
          isDefault: true,
        },
        {
          permissions: ['Read'],
          agentGroups: appConfig.indexedGroups,
          isDefault: true,
        },
      ],
      authenticatedFetch: person.fetch,
    })

    await createResource({
      url: resource,
      body: `
          @prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>.

          <${fragment}>
            a <${thing}>;
            geo:location <#location>.
          <#location> a geo:Location;
            geo:lat 50.012;
            geo:long 15.1234.
        `,
      authenticatedFetch: person.fetch,
    })
  }

  describe('group member', () => {
    it('[thing not found, not saved] should respond with 404 and save nothing', async () => {
      await beforeNotSaved(accommodation)
      await beforeNotFound(accommodation, { createContainer: true })

      await createRandomThingsInDb(10)

      expect(await Thing.count()).toBe(10)

      const response = await person.fetch(`${appConfig.baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Create',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Document',
            id: accommodation,
          },
        }),
      })

      expect(response.status).toBe(404)

      expect(await Thing.count()).toBe(10)
    })

    it('[thing not found, saved] should remove it from db and respond with 204 and delete it from db', async () => {
      await createRandomThingsInDb(10)
      await beforeSaved(accommodation)
      await beforeNotFound(accommodation, { createContainer: true })

      expect(await Thing.count()).toBe(11)

      const response = await person.fetch(`${appConfig.baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Delete',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Document',
            id: accommodation,
          },
        }),
      })

      expect(response.status).toBe(204)

      expect(await Thing.count()).toBe(10)
    })

    it('[thing found, not relevant, not saved] should respond with 400', async () => {
      await createRandomThingsInDb(10)
      await beforeNotSaved(accommodation)
      await beforeFound(
        accommodation,
        person,
        `https://example.com/ns#Accommodation`,
      )
      expect(await Thing.count()).toBe(10)

      const response = await person.fetch(`${appConfig.baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Create',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Document',
            id: accommodation,
          },
        }),
      })

      expect(response.status).toBe(400)
      const body = await response.text()
      expect(body).toContain("The service doesn't index things of this type")
      expect(body).toContain(
        `Expected types: <${
          hospex + 'Accommodation'
        }>. Actual types: <https://example.com/ns#Accommodation>.`,
      )
      expect(await Thing.count()).toBe(10)
    })

    it('[thing found, not relevant, saved] should remove it from db and respond with 204', async () => {
      await createRandomThingsInDb(10)
      await beforeSaved(accommodation)
      await beforeFound(
        accommodation,
        person,
        `https://example.com/ns#Accommodation`,
      )
      expect(await Thing.count()).toBe(11)

      const response = await person.fetch(`${appConfig.baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Update',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Document',
            id: accommodation,
          },
        }),
      })

      expect(response.status).toBe(204)

      expect(await Thing.count()).toBe(10)
    })

    it('[thing found, relevant, not saved] should add it to db and respond with 201', async () => {
      await beforeNotSaved(accommodation)
      await beforeFound(accommodation, person)

      const response = await person.fetch(`${appConfig.baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Create',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Document',
            id: accommodation,
          },
        }),
      })

      expect(response.status).toBe(201)

      const thingsAfter = await Thing.findAll()

      expect(thingsAfter).toHaveLength(1)

      const thingsAtLocation = await Thing.findAll({
        where: { geohash: { [Op.like]: 'u%' } },
      })

      expect(thingsAtLocation).toHaveLength(1)
    })

    it('[thing found, relevant, saved] should update it in db and respond with 200', async () => {
      await beforeSaved(accommodation)
      await beforeFound(accommodation, person)

      const thingsBefore = await Thing.findAll()

      expect(thingsBefore).toHaveLength(1)

      const response = await person.fetch(`${appConfig.baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Update',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Document',
            id: accommodation,
          },
        }),
      })

      expect(response.status).toBe(200)

      const thingsAfter = await Thing.findAll()

      expect(thingsAfter).toHaveLength(1)

      const thingsAtLocation = await Thing.findAll({
        where: { geohash: { [Op.like]: 'u%' } },
      })

      expect(thingsAtLocation).toHaveLength(1)
    })

    it.todo(
      '[thing belongs to somebody else] should respond with 400 (TODO think through edge cases, like change in ownership - we probably always want 400)',
    )

    it.todo("[thing couldn't be accessed] TODO")

    it.todo(
      '[thing found, invalid, saved] should remove the thing and respond 204',
    )
    it.todo('[thing found, invalid, not saved] should respond with 400')
  })
})
