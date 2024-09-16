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
