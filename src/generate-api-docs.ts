// https://swagger-autogen.github.io/docs/getting-started/advanced-usage#openapi-3x
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import swaggerAutogen from 'swagger-autogen'
import { notification } from './schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const doc = {
  info: {
    version: '',
    title: 'SolidCouch Geoindex',
    description:
      'This is a geoindex for Solid apps. Read more at https://github.com/solidcouch/geoindex',
  },
  servers: [{ url: '/' }],
  tags: [],
  components: { '@schemas': { notification } },
}

const outputFile = path.join(__dirname, '../apidocs/openapi.json')
const routes = [path.join(__dirname, '../src/app.ts')]

await swaggerAutogen({ openapi: '3.1.0' })(outputFile, routes, doc)
