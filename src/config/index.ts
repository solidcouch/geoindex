import 'dotenv/config'

// the defaults work for tests. you should define your own
// either via .env file, or via environment variables directly (depends on your setup)

// server base url, e.g. to construct correct email verification links
export const baseUrl = process.env.BASE_URL ?? 'http://localhost:3005'

const stringToBoolean = (value: string | undefined): boolean => {
  if (value === 'false') return false
  if (value === '0') return false
  return !!value
}

export const port: number = +(process.env.PORT ?? 3005)

export const isBehindProxy = stringToBoolean(process.env.BEHIND_PROXY)

const stringToArray = (value: string | undefined) => {
  if (!value) return []
  return value.split(/\s*,\s*/)
}

export const allowedGroups = stringToArray(process.env.ALLOWED_GROUPS)
