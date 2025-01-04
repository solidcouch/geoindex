import addFormats from 'ajv-formats'
import { default as Ajv2020 } from 'ajv/dist/2020.js'
import { Parser, Quad_Object, Store } from 'n3'
import ngeohash from 'ngeohash'
import { rdf } from 'rdf-namespaces'
import { Thing } from '../database.js'
import { geo } from '../namespaces.js'
import { rawThingSchema } from '../schema.js'
import { HttpError, ValidationError } from './errors.js'

const ajv = new Ajv2020.default({ allErrors: true, strictNumbers: true })
addFormats.default(ajv)

export const fetchThing = async (
  uri: string,
  fetch: typeof globalThis.fetch,
) => {
  const response = await fetch(uri)

  if (!response.ok) throw new HttpError("Thing couldn't be fetched", response)

  const parser = new Parser({
    format: (response.headers.get('content-type') as string) ?? 'text/turtle',
    baseIRI: uri,
  })

  const body = await response.text()

  const quads = parser.parse(body)
  const store = new Store(quads)
  const locations = store.getObjects(uri, geo + 'location', null)
  const types = store.getObjects(uri, rdf.type, null)
  const latitudes = locations.flatMap(loc =>
    store.getObjects(loc, geo + 'lat', null),
  )
  const longitudes = locations.flatMap(loc =>
    store.getObjects(loc, geo + 'long', null),
  )

  return { types, latitudes, longitudes }
}

export const validateThing = (
  rawThing: {
    types: Quad_Object[]
    latitudes: Quad_Object[]
    longitudes: Quad_Object[]
  },
  { allowedTypes: thingTypes }: { allowedTypes: string[] },
): { latitude: number; longitude: number } => {
  const types = rawThing.types
    .filter(t => t.termType === 'NamedNode')
    .map(t => t.value)
  const latitudesOk = rawThing.latitudes.every(l => l.termType === 'Literal')
  const longitudesOk = rawThing.longitudes.every(l => l.termType === 'Literal')

  if (!(latitudesOk && longitudesOk))
    throw new ValidationError('Latitude or Longitude is not a literal', [])
  const latitudes = rawThing.latitudes.map(lat => Number(lat.value))
  const longitudes = rawThing.longitudes.map(long => Number(long.value))

  const validate = ajv.compile(rawThingSchema(thingTypes))
  const isValid = validate({ types, latitudes, longitudes })

  if (!isValid)
    throw new ValidationError('Thing is not valid', validate.errors ?? [])

  if (!latitudes[0] || !longitudes[0])
    throw new ValidationError('Latitude or longitude is missing', [])

  const latitude = latitudes[0]
  const longitude = longitudes[0]

  return { latitude, longitude }
}

export const saveThing = async ({
  uri,
  latitude,
  longitude,
}: {
  uri: string
  latitude: number
  longitude: number
}) => {
  const geohash = ngeohash.encode(latitude, longitude, 10)
  const thingCountBefore = await Thing.count({ where: { uri } })

  await Thing.upsert({ uri, geohash })

  return thingCountBefore ? 200 : 201
}
