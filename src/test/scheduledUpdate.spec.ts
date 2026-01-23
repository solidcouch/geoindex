import assert from 'node:assert/strict'
import { foaf, sioc } from 'rdf-namespaces'
import { beforeEach, describe, expect, it } from 'vitest'
import { Thing } from '../database.js'
import { hospex } from '../namespaces.js'
import { refreshIndex } from '../tasks/refreshIndex.js'
import {
  createRandomAccount,
  generateAccommodationUri,
  getContainer,
  getResource,
  setupThingsForPerson,
} from './helpers/index.js'
import { createResource } from './helpers/setupPod.js'
import type { Person } from './helpers/types.js'
import { appConfig, group, testConfig } from './setup.js'

describe('The service regularly crawls Things of its group members, and updates itself accordingly.', () => {
  let thingsCount = 0
  let people: Person[] = []
  let communityUri = ''
  beforeEach(async () => {
    thingsCount = 0
    // update the group - make it have many members
    expect(appConfig.indexedGroups).toHaveLength(1)

    if (!appConfig.allowedGroups[0])
      throw new Error('No allowed groups specified')

    communityUri = getContainer(appConfig.allowedGroups[0]) + 'community#us'

    people = []
    // create Things for these many members - randomly between 0 and 5 things
    for (let i = 0; i < 10; ++i) {
      const account = await createRandomAccount({
        solidServer: testConfig.cssUrl,
      })
      const thingsForPerson = Math.floor(Math.random() * 6)
      const {
        hospexContainer,
        personalHospexDocument,
        typeIndex,
        accommodations,
      } = await setupThingsForPerson({
        person: account,
        group: appConfig.allowedGroups[0],
        community: communityUri,
        things: thingsForPerson,
      })

      people.push({
        account,
        pod: { publicTypeIndex: typeIndex },
        hospex: {
          hospexContainer,
          personalHospexDocument,
          accommodations,
        },
      })

      thingsCount += thingsForPerson
    }

    // update group
    await createResource({
      url: appConfig.allowedGroups[0],
      body: `
      @prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
      <#us> vcard:hasMember ${people
        .map(person => `<${person.account.webId}>`)
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
  }, 60000)

  it('should go through all members and fresh-update the records of each member (remove all that is missing, add all that is available for each person)', async () => {
    expect(appConfig.indexedGroups).toHaveLength(1)
    expect(await Thing.count()).toBe(0)
    await refreshIndex(
      appConfig.indexedGroups,
      appConfig.webId,
      appConfig.thingTypes,
    )
    expect(await Thing.count()).toBe(thingsCount)
  })

  it.todo(
    '[request goes 502] should make a note and ignore stuff, and if 502 lasts over multiple updates, remove the thing',
  )

  it.todo(
    'should swallow errors, work regularly, overwrite outdated things and non-existent people, should not work twice if overlap goes on',
  )

  it('should swallow missing thing document error (fetch error code or network error)', async () => {
    // let's have a member (early in the list) with thing predicates leading to errors
    const person = people.find(p => p.hospex.accommodations.length > 1)
    if (!person) throw new Error('no person with accommodations found')

    // await patchFile({
    //   url: person.hospex.personalHospexDocument,
    //   inserts: `<${person.account.webId}> <${hospex}offers> <${generateAccommodationUri(person.account)}>`,
    //   authenticatedFetch: person.account.fetch,
    // })
    await createResource({
      url: person.hospex.personalHospexDocument,
      body: `
        @prefix hospex: <${hospex}>.
        <${person.account.webId}> <${sioc.member_of}> <${communityUri}>;
        hospex:offers <${generateAccommodationUri(person.account)}>, "hello!";
        ${
          person.hospex.accommodations.length > 0
            ? 'hospex:offers ' +
              person.hospex.accommodations.map(a => `<${a.uri}>`).join(', ') +
              ';'
            : ''
        }
        hospex:storage <${person.hospex.hospexContainer}>.
        `,
      authenticatedFetch: person.account.fetch,
    })

    expect(await Thing.count()).toBe(0)
    await refreshIndex(
      appConfig.indexedGroups,
      appConfig.webId,
      appConfig.thingTypes,
    )
    expect(await Thing.count()).toBe(thingsCount)
  })

  it('should swallow errors in validation', async () => {
    const person = people.find(p => p.hospex.accommodations.length > 1)
    assert(person)
    const accommodation = person.hospex.accommodations[0]
    assert(accommodation)

    const resource = getResource(accommodation.uri)
    const fragment = new URL(accommodation.uri).hash
    await createResource({
      url: resource,
      body: `
          @prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>.

          <${fragment}>
            a <${hospex + 'Accommodation'}>;
            geo:location <#location>.
          <#location> a geo:Location;
            geo:lat ${accommodation.lat}, 5.2;
            geo:long ${accommodation.long}.
        `,
      authenticatedFetch: person.account.fetch,
    })

    expect(await Thing.count()).toBe(0)
    await refreshIndex(
      appConfig.indexedGroups,
      appConfig.webId,
      appConfig.thingTypes,
    )
    expect(await Thing.count()).toBe(thingsCount - 1)
  })
})
