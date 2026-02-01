import { bodyParser } from '@koa/bodyparser'
import cors from '@koa/cors'
import Router from '@koa/router'
import { solidIdentity } from '@soid/koa'
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
import { authorizeGroups } from './middlewares/authorizeGroup.js'
import { type AppConfig, loadConfig } from './middlewares/loadConfig.js'
import { solidAuth } from './middlewares/solidAuth.js'
import { validateBody } from './middlewares/validate.js'
import * as schema from './schema.js'

const createApp = async (config: AppConfig) => {
  const identity = solidIdentity(config.webId)

  await initializeDatabase(config.database)

  const app = new Koa()
  app.proxy = config.isBehindProxy
  const router = new Router<{ config: AppConfig } & { user: string }>()

  router
    .use(identity.routes())
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
        encoding: 'utf-8',
      }),
    )
    .use(loadConfig(config))
    .use(serve('./apidocs'))
    .use(router.routes())
    .use(router.allowedMethods())

  return app
}

export { createApp }
