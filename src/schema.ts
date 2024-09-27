import { JSONSchemaType } from 'ajv/dist/2020.js'

export const notification: JSONSchemaType<{
  type: 'Create' | 'Update' | 'Delete'
  id: string
  '@context': 'https://www.w3.org/ns/activitystreams'
  actor: { type: 'Person'; id: string }
  object: {
    type: 'Document' | 'Place'
    id: string
  }
}> = {
  type: 'object',
  properties: {
    '@context': {
      type: 'string',
      const: 'https://www.w3.org/ns/activitystreams',
    },
    id: { type: 'string' },
    type: { type: 'string', enum: ['Create', 'Update', 'Delete'] },
    actor: {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'Person' },
        id: { type: 'string', format: 'uri' },
      },
      required: ['type', 'id'],
    },
    object: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['Document', 'Place'] },
        id: { type: 'string', format: 'uri' },
      },
      required: ['type', 'id'],
    },
  },
  required: ['@context', 'type', 'actor', 'object'],
  additionalProperties: false,
}

export const rawThingSchema = (
  thingTypes: string[],
): JSONSchemaType<{
  types: string[]
  latitudes: number[]
  longitudes: number[]
}> => ({
  type: 'object',
  properties: {
    types: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
      contains: { enum: thingTypes },
    },
    latitudes: {
      type: 'array',
      minItems: 1,
      maxItems: 1,
      items: { type: 'number' },
    },
    longitudes: {
      type: 'array',
      minItems: 1,
      maxItems: 1,
      items: { type: 'number' },
    },
  },
  required: ['types', 'latitudes', 'longitudes'],
})
