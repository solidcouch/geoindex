import bodyParser from '@koa/bodyparser'
import cors from '@koa/cors'
import Router from '@koa/router'
import Koa from 'koa'
import helmet from 'koa-helmet'
import serve from 'koa-static'
import { allowedGroups, baseUrl, isBehindProxy } from './config'
import {
  fetchThing,
  saveThing,
  validateThing,
} from './controllers/processThing'
import { queryThings } from './controllers/query'
import { fullJwkPublicKey } from './identity'
import { authorizeGroups } from './middlewares/authorizeGroup'
import { solidAuth } from './middlewares/solidAuth'
import { validateBody } from './middlewares/validate'
import * as schema from './schema'

const app = new Koa()
app.proxy = isBehindProxy
const router = new Router()

router.get('/.well-known/openid-configuration', async ctx => {
  ctx.body = {
    issuer: baseUrl,
    jwks_uri: baseUrl + '/jwks',
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
        solid:oidcIssuer <${baseUrl}>.
  `
})

router
  .post(
    '/inbox',
    solidAuth,
    authorizeGroups(allowedGroups),
    /* #swagger.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/init',
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
  .get('/query', solidAuth, authorizeGroups(allowedGroups), queryThings)
// .post(
//   '/notification',
//   solidAuth,
//   authorizeGroups(allowedGroups),
//   /* #swagger.requestBody = {
//     required: true,
//     content: {
//       'application/ld+json': {
//         schema: {
//           $ref: '#/components/schemas/notification',
//         },
//       },
//     },
//   }
//   */
//   validateBody(schema.notification),
//   checkGroupMembership(allowedGroups, 'request.body.target.id', 400),
// )
// .get(
//   '/status/:webId',
//   solidAuth,
//   authorizeGroups(allowedGroups),
//   checkGroupMembership(allowedGroups, 'params.webId', 400),
// )

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
  .use(serve('./apidocs'))
  .use(router.routes())
  .use(router.allowedMethods())

export default app
