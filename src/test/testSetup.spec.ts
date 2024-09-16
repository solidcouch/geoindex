import * as css from '@solid/community-server'
import { IncomingMessage, Server, ServerResponse } from 'http'
import { foaf } from 'rdf-namespaces'
import app from '../app'
import { baseUrl, port } from '../config'
import { createRandomAccount } from './helpers'
import { createResource } from './helpers/setupPod'
import type { Person } from './helpers/types'

let server: Server<typeof IncomingMessage, typeof ServerResponse>
let person: Person
let otherPerson: Person
let person3: Person
let cssServer: css.App
let group: Person & { groupURI?: string; groupResource?: string }

const cssPort = 3456
const cssUrl = `http://localhost:${cssPort}`

before(async function () {
  this.timeout(60000)
  const start = Date.now()

  // eslint-disable-next-line no-console
  console.log('Starting CSS server')
  // Community Solid Server (CSS) set up following example in https://github.com/CommunitySolidServer/hello-world-component/blob/main/test/integration/Server.test.ts
  cssServer = await new css.AppRunner().create({
    loaderProperties: {
      mainModulePath: css.joinFilePath(__dirname, '../../'), // ?
      typeChecking: false, // ?
      dumpErrorState: false, // disable CSS error dump
    },
    config: css.joinFilePath(__dirname, './css-default-config.json'), // CSS config
    variableBindings: {},
    // CSS cli options
    // https://github.com/CommunitySolidServer/CommunitySolidServer/tree/main#-parameters
    shorthand: {
      port: cssPort,
      loggingLevel: 'off',
      seedConfig: css.joinFilePath(__dirname, './css-pod-seed.json'), // set up some Solid accounts
    },
  })
  await cssServer.start()

  // eslint-disable-next-line no-console
  console.log('CSS server started in', (Date.now() - start) / 1000, 'seconds')
})

after(async () => {
  await cssServer.stop()
})

before(done => {
  server = app.listen(port, done)
})

after(done => {
  server.close(done)
})

/**
 * Before each test, create a new account and authenticate to it
 */
beforeEach(async () => {
  person = await createRandomAccount({ solidServer: cssUrl })
  otherPerson = await createRandomAccount({ solidServer: cssUrl })
  person3 = await createRandomAccount({ solidServer: cssUrl })
  group = await createRandomAccount({ solidServer: cssUrl })

  group.groupResource = group.podUrl + 'group'
  group.groupURI = group.groupResource + '#us'

  await createResource({
    url: group.groupResource,
    body: `
      @prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
      <#us> vcard:hasMember <${person.webId}>, <${person3.webId}>, <${baseUrl}/profile/card#bot>.
    `,
    acls: [
      { permissions: ['Read', 'Write', 'Control'], agents: [group.webId] },
      { permissions: ['Read'], agentClasses: [foaf.Agent] },
    ],
    authenticatedFetch: group.fetch,
  })
})

export { group, person }
