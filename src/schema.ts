import { JSONSchemaType } from 'ajv/dist/2020.js'

export const notification = {
  type: 'object',
  properties: {
    '@context': { const: 'https://www.w3.org/ns/activitystreams' },
    id: { type: 'string' },
    type: { const: 'Create' },
    actor: {
      type: 'object',
      properties: {
        type: { const: 'Person' },
        id: { type: 'string', format: 'uri' },
      },
      required: ['type', 'id'],
    },
    object: {
      type: 'object',
      properties: {
        type: { const: 'Thing' },
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
