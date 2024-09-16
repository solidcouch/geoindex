export type GoodBody = {
  '@context': 'https://www.w3.org/ns/activitystreams'
  type: 'Create' | 'Update' | 'Remove'
  actor: { type: 'Person'; id: string }
  object: { type: 'Thing'; id: string }
}
