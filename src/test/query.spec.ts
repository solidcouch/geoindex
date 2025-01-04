import { DataFactory, Parser, Store } from 'n3'
import { describe, expect, it } from 'vitest'
import { Thing } from '../database.js'
import { createRandomThingsInDb } from './helpers/index.js'
import { appConfig, person, person2 } from './setup.js'

const { namedNode, quad, literal } = DataFactory

describe('Group members can query service for Things at certain geohash, using Triple Pattern Fragment* (*including more data than asked for)', () => {
  describe('group member', () => {
    it('should respond with things at given geohash', async () => {
      await createRandomThingsInDb(2000)
      await Thing.create({
        uri: 'https://example.com/example#accommodation',
        geohash: 'ez4npft5gw',
      })
      const response = await person.fetch(
        `${appConfig.baseUrl}/query?predicate=${encodeURIComponent(
          'https://example.com/ns#geohash',
        )}&object=${encodeURIComponent('"ez"')}`,
      )

      expect(response.status).toBe(200)

      expect(response.headers.get('content-type')).toBe('text/turtle')

      const body = await response.text()

      const parser = new Parser()
      const store = new Store(parser.parse(body))

      const quads = store.getQuads(null, null, null, null)
      expect(quads.length).toBeGreaterThanOrEqual(2)
      expect(quads.length).toBeLessThanOrEqual(50) // there is very low probability that more than 25 randomly generated things will hit the right geohash

      // we expect the results to include the searched geohash, and the full geohash
      const expectedTriples = [
        quad(
          namedNode('https://example.com/example#accommodation'),
          namedNode('https://example.com/ns#geohash'),
          literal('ez'),
        ),
        quad(
          namedNode('https://example.com/example#accommodation'),
          namedNode('https://example.com/ns#geohash'),
          literal('ez4npft5gw'),
        ),
      ]

      expectedTriples.forEach(triple => {
        expect(store.has(triple)).toBe(true)
      })
    })

    it.todo('pagination')
    it.todo('validation')
    it.todo('different - unsupported - query paramvalues')
    it.todo('no query params specified')
  })

  describe('not a group member', () => {
    it('should return 403', async () => {
      await Thing.create({
        uri: 'https://example.com/example#accommodation',
        geohash: 'uxezuxezuxez',
      })
      const response = await person2.fetch(
        `${appConfig.baseUrl}/query?predicate=${encodeURIComponent(
          'https://example.com/ns#geohash',
        )}&object=${encodeURIComponent('"ux"')}`,
      )

      expect(response.status).toBe(403)
    })
  })

  describe('not authenticated', () => {
    it('should return 401', async () => {
      await Thing.create({
        uri: 'https://example.com/example#accommodation',
        geohash: 'uxezuxezuxez',
      })
      const response = await fetch(
        `${appConfig.baseUrl}/query?predicate=${encodeURIComponent(
          'https://example.com/ns#geohash',
        )}&object=${encodeURIComponent('"ux"')}`,
      )

      expect(response.status).toBe(401)
    })
  })
})
