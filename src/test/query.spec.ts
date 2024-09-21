import { expect } from 'chai'
import { DataFactory, Parser, Store } from 'n3'
import { baseUrl } from '../config'
import { Thing } from '../database'
import { createRandomThingsInDb } from './helpers'
import { person, person2 } from './testSetup.spec'

const { namedNode, quad, literal } = DataFactory

describe('Group members can query service for Things at certain geohash, using Triple Pattern Fragment* (*including more data than asked for)', () => {
  context('group member', () => {
    it('should respond with things at given geohash', async () => {
      await createRandomThingsInDb(2000)
      await Thing.create({
        uri: 'https://example.com/example#accommodation',
        geohash: 'ez4npft5gw',
      })
      const response = await person.fetch(
        `${baseUrl}/query?predicate=${encodeURIComponent(
          'https://example.com/ns#geohash',
        )}&object=${encodeURIComponent('"ez"')}`,
      )

      expect(response.status).to.equal(200)

      const body = await response.text()

      const parser = new Parser()
      const store = new Store(parser.parse(body))

      const quads = store.getQuads(null, null, null, null)
      expect(quads.length).to.be.within(2, 50) // there is very low probability that more than 25 randomly generated things will hit the right geohash

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
        expect(store.has(triple)).to.be.true
      })

      console.log(body, '***')
    })
  })

  context('not a group member', () => {
    it('should return 403', async () => {
      await Thing.create({
        uri: 'https://example.com/example#accommodation',
        geohash: 'uxezuxezuxez',
      })
      const response = await person2.fetch(
        `${baseUrl}/query?predicate=${encodeURIComponent(
          'https://example.com/ns#geohash',
        )}&object=${encodeURIComponent('"ux"')}`,
      )

      expect(response.status).to.equal(403)
    })
  })

  context('not authenticated', () => {
    it('should return 401', async () => {
      await Thing.create({
        uri: 'https://example.com/example#accommodation',
        geohash: 'uxezuxezuxez',
      })
      const response = await fetch(
        `${baseUrl}/query?predicate=${encodeURIComponent(
          'https://example.com/ns#geohash',
        )}&object=${encodeURIComponent('"ux"')}`,
      )

      expect(response.status).to.equal(401)
    })
  })
})
