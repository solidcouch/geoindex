import * as dotenv from 'dotenv'
import { type Writable } from 'type-fest'
import { afterAll, beforeAll, beforeEach } from 'vitest'

dotenv.config({ path: '.env.test' })

import * as css from '@solid/community-server'
import { IncomingMessage, Server, ServerResponse } from 'http'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { foaf } from 'rdf-namespaces'
import { createApp } from '../app.js'
import * as importedConfig from '../config/index.js'
import { Thing } from '../database.js'
import { type AppConfig } from '../middlewares/loadConfig.js'
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
let group: Person
const appConfig: Writable<AppConfig> & { baseUrl: string } = {
  ...importedConfig,
  baseUrl: '',
}
const testConfig = {
  cssPort: -1,
  cssUrl: '',
}

beforeAll(() => {
  testConfig.cssPort = getRandomPort()
  testConfig.cssUrl = `http://localhost:${testConfig.cssPort}`

  appConfig.indexedGroups = [testConfig.cssUrl + '/group/group#us']
  appConfig.allowedGroups = appConfig.indexedGroups
  appConfig.port = getRandomPort()
  appConfig.baseUrl = `http://localhost:${appConfig.port}`
  appConfig.webId = new URL('/profile/card#bot', appConfig.baseUrl).toString()
})

beforeAll(async () => {
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
    config: css.joinFilePath(__dirname, './css-default-config.json'), // CSS appConfig
    variableBindings: {},
    // CSS cli options
    // https://github.com/CommunitySolidServer/CommunitySolidServer/tree/main#-parameters
    shorthand: {
      port: testConfig.cssPort,
      loggingLevel: 'off',
      seedConfig: css.joinFilePath(__dirname, './css-pod-seed.json'), // set up some Solid accounts
    },
  })
  await cssServer.start()

  // eslint-disable-next-line no-console
  console.log(
    'CSS server started on port',
    testConfig.cssPort,
    'in',
    (Date.now() - start) / 1000,
    'seconds',
  )
}, 60000)

afterAll(async () => {
  await cssServer.stop()
})

beforeAll(async () => {
  const app = await createApp(appConfig)

  server = await new Promise(resolve => {
    const srv = app.listen(appConfig.port, () => {
      resolve(srv)
    })
  })
})

afterAll(async () => {
  await new Promise(resolve => server.close(resolve))
})

// clear the database before each test
beforeEach(async () => {
  await Thing.destroy({ truncate: true })
})

/**
 * Before each test, create a new account and authenticate to it
 */
beforeEach(async () => {
  person = await createRandomAccount({ solidServer: testConfig.cssUrl })
  person2 = await createRandomAccount({ solidServer: testConfig.cssUrl })
  person3 = await createRandomAccount({ solidServer: testConfig.cssUrl })
  // group = await createRandomAccount({ solidServer: cssUrl })

  // this account is defined in css-pod-seed.json
  group = await getDefaultPerson(
    {
      email: 'group@example',
      password: 'correcthorsebatterystaple',
      pods: [{ name: 'group' }],
    },
    testConfig.cssUrl,
  )

  if (!appConfig.indexedGroups[0]) throw new Error('No indexed groups')

  await createResource({
    url: appConfig.indexedGroups[0],
    body: `
      @prefix vcard: <http://www.w3.org/2006/vcard/ns#> .
      <#us> vcard:hasMember <${person.webId}>, <${person3.webId}>, <${appConfig.baseUrl}/profile/card#bot>.
    `,
    acls: [
      { permissions: ['Read', 'Write', 'Control'], agents: [group.webId] },
      { permissions: ['Read'], agentClasses: [foaf.Agent] },
    ],
    authenticatedFetch: group.fetch,
  })
}, 20000)

export { appConfig, group, person, person2, testConfig }
