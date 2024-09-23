import * as css from '@solid/community-server'
import { IncomingMessage, Server, ServerResponse } from 'http'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { foaf } from 'rdf-namespaces'
import { createApp } from '../app.js'
import * as config from '../config/index.js'
import { Thing } from '../database.js'
import {
  createRandomAccount,
  getDefaultPerson,
  getRandomPort,
} from './helpers/index.js'
import { createResource } from './helpers/setupPod.js'
import type { Person } from './helpers/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let server: Server<typeof IncomingMessage, typeof ServerResponse>
let person: Person
let person2: Person
let person3: Person
let cssServer: css.App
let group: Person & { groupURI?: string }
let cssPort: number
let cssUrl: string
let baseUrl: string
let port: number
let allowedGroups: string[]

before(() => {
  cssPort = getRandomPort()
  cssUrl = `http://localhost:${cssPort}`
  allowedGroups = [cssUrl + '/group/group#us']

  port = getRandomPort()
  baseUrl = `http://localhost:${port}`
})

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
  console.log(
    'CSS server started on port',
    cssPort,
    'in',
    (Date.now() - start) / 1000,
    'seconds',
  )
})

after(async () => {
  await cssServer.stop()
})

before(done => {
  createApp({
    ...config,
    baseUrl,
    allowedGroups,
  }).then(app => {
    server = app.listen(port, done)
  })
})

after(done => {
  server.close(done)
})

// clear the database before each test
beforeEach(async () => {
  await Thing.destroy({ truncate: true })
})

/**
 * Before each test, create a new account and authenticate to it
 */
beforeEach(async () => {
  person = await createRandomAccount({ solidServer: cssUrl })
  person2 = await createRandomAccount({ solidServer: cssUrl })
  person3 = await createRandomAccount({ solidServer: cssUrl })
  // group = await createRandomAccount({ solidServer: cssUrl })

  // this account is defined in css-pod-seed.json
  group = await getDefaultPerson(
    {
      email: 'group@example',
      password: 'correcthorsebatterystaple',
      pods: [{ name: 'group' }],
    },
    cssUrl,
  )

  group.groupURI = group.podUrl + 'group#us'

  await createResource({
    url: group.groupURI,
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

export { baseUrl, group, person, person2 }
