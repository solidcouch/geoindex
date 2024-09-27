import { bodyParser } from '@koa/bodyparser'
import cors from '@koa/cors'
import Router from '@koa/router'
import Koa from 'koa'
import helmet from 'koa-helmet'
import serve from 'koa-static'
import {
  fetchThing,
  saveThing,
  validateThing,
} from './controllers/processThing.js'
import { queryThings } from './controllers/query.js'
import { initializeDatabase } from './database.js'
import { fullJwkPublicKey } from './identity.js'
import { authorizeGroups } from './middlewares/authorizeGroup.js'
import { AppConfig, loadConfig } from './middlewares/loadConfig.js'
import { solidAuth } from './middlewares/solidAuth.js'
import { validateBody } from './middlewares/validate.js'
import * as schema from './schema.js'

const createApp = async (config: AppConfig) => {
  await initializeDatabase(config.database)

  const app = new Koa()
  app.proxy = config.isBehindProxy
  const router = new Router<{ config: AppConfig } & { user: string }>()

  router.get('/.well-known/openid-configuration', async ctx => {
    ctx.body = {
      issuer: config.baseUrl,
      jwks_uri: config.baseUrl + '/jwks',
      response_types_supported: ['id_token', 'token'],
      scopes_supported: ['openid', 'webid'],
    }
  })

  router.get('/jwks', async ctx => {
    ctx.body = { keys: [fullJwkPublicKey] }
  })

  router.get('/profile/card', async ctx => {
    ctx.set('Content-Type', 'text/turtle')

    ctx.body = `
    @prefix solid: <http://www.w3.org/ns/solid/terms#>.
    @prefix foaf: <http://xmlns.com/foaf/0.1/>.

    <#bot>
        a foaf:Agent;
        solid:oidcIssuer <${config.baseUrl}>.
  `
  })

  router
    .post(
      '/inbox',
      solidAuth,
      authorizeGroups(config.allowedGroups),
      /* #swagger.requestBody = {
        required: true,
        content: {
          'application/ld+json': {
            schema: {
              $ref: '#/components/schemas/notification',
            },
          },
        },
      }
      */
      validateBody(schema.notification),
      fetchThing,
      validateThing,
      saveThing,
    )
    .get(
      '/query',
      solidAuth,
      authorizeGroups(config.allowedGroups),
      queryThings,
    )

  app
    .use(helmet())
    .use(cors())
    .use(
      bodyParser({
        enableTypes: ['text', 'json'],
        extendTypes: {
          json: ['application/ld+json', 'application/json'],
          text: ['text/turtle'],
        },
      }),
    )
    .use(loadConfig(config))
    .use(serve('./apidocs'))
    .use(router.routes())
    .use(router.allowedMethods())
  return app
}

export { createApp }
