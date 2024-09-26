import { expect } from 'chai'
import { foaf } from 'rdf-namespaces'
import { Thing } from '../database.js'
import { refreshIndex } from '../tasks/refreshIndex.js'
import {
  createRandomAccount,
  getContainer,
  getResource,
  setupThingsForPerson,
} from './helpers/index.js'
import { createResource } from './helpers/setupPod.js'
import { Person } from './helpers/types.js'
import { appConfig, group, testConfig } from './testSetup.spec.js'

describe('The service regularly crawls Things of its group members, and updates itself accordingly.', () => {
  let thingsCount = 0
  beforeEach(async function () {
    this.timeout(60000)
    // update the group - make it have many members
    expect(appConfig.indexedGroups).to.have.length(1)
    const communityUri =
      getContainer(appConfig.allowedGroups[0]) + 'community#us'

    const people: Person[] = []
    // create Things for these many members - randomly between 0 and 5 things
    for (let i = 0; i < 10; ++i) {
      const account = await createRandomAccount({
        solidServer: testConfig.cssUrl,
      })
      people.push(account)
      const thingsForPerson = Math.floor(Math.random() * 6)
      await setupThingsForPerson({
        person: account,
        group: appConfig.allowedGroups[0],
        community: communityUri,
        things: thingsForPerson,
      })
      thingsCount += thingsForPerson
    }

    // update group
    await createResource({
      url: appConfig.allowedGroups[0],
      body: `
      @prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
      <#us> vcard:hasMember ${people
        .map(person => `<${person.webId}>`)
        .join(', ')}, <${appConfig.baseUrl}/profile/card#bot>.
    `,
      acls: [
        { permissions: ['Read', 'Write', 'Control'], agents: [group.webId] },
        { permissions: ['Read'], agentClasses: [foaf.Agent] },
      ],
      authenticatedFetch: group.fetch,
    })
    // create community for the group
    await createResource({
      url: getResource(communityUri),
      body: `
      @prefix foaf: <http://xmlns.com/foaf/0.1/>.
      @prefix hospex: <http://w3id.org/hospex/ns#>.
      @prefix sioc: <http://rdfs.org/sioc/ns#>.

      <${new URL(communityUri).hash}>
        a hospex:Community, sioc:Community;
        sioc:name "Test community"@en;
        sioc:has_usergroup <${appConfig.allowedGroups[0]}>.
    `,
      acls: [
        { permissions: ['Read', 'Write', 'Control'], agents: [group.webId] },
        { permissions: ['Read'], agentClasses: [foaf.Agent] },
      ],
      authenticatedFetch: group.fetch,
    })
  })

  it('should go through all members and fresh-update the records of each member (remove all that is missing, add all that is available for each person)', async () => {
    expect(appConfig.indexedGroups).to.have.length(1)
    expect(await Thing.count()).to.equal(0)
    await refreshIndex(
      appConfig.indexedGroups,
      appConfig.baseUrl,
      appConfig.thingTypes,
    )
    expect(await Thing.count()).to.equal(thingsCount)
  })

  it(
    '[request goes 502] should make a note and ignore stuff, and if 502 lasts over multiple updates, remove the thing',
  )

  it(
    'it should swallow errors, work regularly, overwrite outdated things and non-existent people, should not work twice if overlap goes on',
  )
})
