import { expect } from 'chai'
import { v4 as uuidv4 } from 'uuid'
import { baseUrl } from '../config'
import { createContainer, createResource } from './helpers/setupPod'
import { group, person } from './testSetup.spec'

describe("POST /inbox When a person creates, updates, or removes a Thing, they can send a notification to this service's inbox. The service will fetch and save the thing's uri, location and owner, as long as it is a valid thing interesting for this service.", () => {
  context('not authenticated', () => {
    it('should respond with 401')
  })

  context('not a group member', () => {
    it('should respond with 403')
  })

  context('group member', () => {
    it('[thing not found, not saved] should respond with 404')

    it('[thing not found, saved] should remove it from db and respond with 204')

    it('[thing found, not relevant, not saved] should respond with 400')

    it(
      '[thing found, not relevant, saved] should remove it from db and respond with 204',
    )

    it('[thing found, relevant, not saved] should add it to db and respond with 201', async () => {
      // TODO create an accommodation that the group can read
      await createContainer({
        url: person.podUrl + 'hospex/test/',
        acls: [
          {
            permissions: ['Read', 'Write', 'Control'],
            agents: [person.webId],
            isDefault: true,
          },
          {
            permissions: ['Read'],
            agentGroups: [group.groupURI!],
            isDefault: true,
          },
        ],
        authenticatedFetch: person.fetch,
      })

      const accommodation = person.podUrl + 'hospex/test/' + uuidv4()

      await createResource({
        url: accommodation,
        body: `
          @prefix hospex: <>.
          @prefix geo: <>.

          <#accommodation>
            a hospex:Accommodation;
            geo:location <#location>.
          <#location> a geo:Location;
            geo:latitude 50.012;
            geo:longitude 15.1234.
        `,
        authenticatedFetch: person.fetch,
      })

      const response = await person.fetch(`${baseUrl}/inbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/ld+json' },
        body: JSON.stringify({
          '@context': 'https://www.w3.org/ns/activitystreams',
          type: 'Create',
          actor: { type: 'Person', id: person.webId },
          object: {
            type: 'Thing',
            id: accommodation + '#accommodation',
          },
        }),
      })

      expect(response.status).to.equal(201)
    })

    it(
      '[thing found, relevant, saved] should update it in db and respond with 200',
    )

    it(
      '[thing belongs to somebody else] should respond with 400 (TODO think through edge cases, like change in ownership - we probably always want 400)',
    )

    it("[thing couldn't be accessed] TODO")
  })
})
