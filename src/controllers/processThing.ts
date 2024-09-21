import type { Middleware } from 'koa'
import { Parser, Store } from 'n3'
import ngeohash from 'ngeohash'
import { rdf } from 'rdf-namespaces'
import { thingTypes } from '../config'
import { Thing } from '../database'
import { getAuthenticatedFetch } from '../identity'
import { geo } from '../namespaces'

export const fetchThing: Middleware = async ctx => {
  const {
    object: { id: thing },
  } = ctx.request.body

  if (typeof thing !== 'string') throw new Error('thing is not URI')

  const authFetch = await getAuthenticatedFetch()

  const response = await authFetch(thing)

  if (response.status === 404) {
    const deletedRows = await Thing.destroy({ where: { uri: thing } })

    if (deletedRows) {
      ctx.status = 204
      return
    } else ctx.throw(404, 'Thing not found')
  }

  if (!response.ok) throw new Error('Not accessible')

  const parser = new Parser({
    format: <string>ctx.response.headers['content-type'] ?? 'text/turtle',
    baseIRI: thing,
  })

  const body = await response.text()

  const quads = parser.parse(body)
  const store = new Store(quads)
  const locations = store.getObjects(thing, geo + 'location', null)
  const types = store.getObjects(thing, rdf.type, null)
  const latitudes = locations
    .flatMap(loc => store.getObjects(loc, geo + 'lat', null))
    .map(n => Number(n.value))
  const longitudes = locations
    .flatMap(loc => store.getObjects(loc, geo + 'long', null))
    .map(n => Number(n.value))

  const relevantTypes = types
    .filter(type => type.termType === 'NamedNode')
    .filter(type => thingTypes.includes(type.value))

  const hasRelevantType = relevantTypes.length > 0

  if (!hasRelevantType) {
    const count = await Thing.count({ where: { uri: thing } })

    const expectedActual = `Expected types: ${thingTypes
      .map(type => `<${type}>`)
      .join(', ')}. Actual types: ${types
      .map(type => `<${type.value}>`)
      .join(',')}.`

    if (count > 0) {
      await Thing.destroy({ where: { uri: thing } })
      ctx.status = 204
      ctx.body =
        "The thing was removed from the index because it doesn't have a relevant type. " +
        expectedActual
      return
    } else
      ctx.throw(
        400,
        "The service doesn't index things of this type. " + expectedActual,
      )
  }

  if (
    latitudes.length !== 1 ||
    longitudes.length !== 1 ||
    isNaN(latitudes[0]) ||
    isNaN(longitudes[0])
  )
    throw new Error('invalid location of the thing')

  const coordinates: [number, number] = [latitudes[0], longitudes[0]]

  const geohash = ngeohash.encode(...coordinates, 10)

  const thingCountBefore = await Thing.count({ where: { uri: thing } })

  await Thing.upsert({ uri: thing, geohash })

  console.log('***********', coordinates, geohash)

  ctx.status = thingCountBefore ? 200 : 201
}

export const validateThing: Middleware = async (ctx, next) => {
  await next()
}

export const saveThing: Middleware = async ctx => {
  ctx.status = 201
}
