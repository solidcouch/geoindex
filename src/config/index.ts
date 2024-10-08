import { Options } from 'sequelize'
import { hospex } from '../namespaces.js'
import { ConfigError } from '../utils/errors.js'
import { stringToArray, stringToBoolean } from './helpers.js'

// define environment variables via .env file, or via environment variables directly (depends on your setup)

if (!process.env.PORT || isNaN(Number(process.env.PORT))) {
  throw new ConfigError(
    'Please specify the PORT at which the app should run in .env or environment variables',
  )
}
export const port = +process.env.PORT

// server base url, e.g. to construct correct email verification links
export const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}`
export const webId = new URL('/profile/card#bot', baseUrl).toString()

export const isBehindProxy = stringToBoolean(process.env.BEHIND_PROXY)

// indexed groups are required
if (!process.env.INDEXED_GROUPS) {
  throw new ConfigError(
    'Please specify comma-separated list of INDEXED_GROUPS in .env or environment variables',
  )
}

export const indexedGroups = stringToArray(process.env.INDEXED_GROUPS)

export const allowedGroups =
  typeof process.env.ALLOWED_GROUPS === 'undefined'
    ? indexedGroups
    : stringToArray(process.env.ALLOWED_GROUPS)

export const thingTypes = stringToArray(
  process.env.THING_TYPES ?? hospex + 'Accommodation',
)

export const refreshSchedule = process.env.REFRESH_SCHEDULE ?? '0 */6 * * *'

export const database: Options = {
  dialect: 'sqlite',
  storage: undefined,
}
