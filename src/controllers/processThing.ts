import type { Middleware } from 'koa'
import { getAuthenticatedFetch } from '../identity'

export const fetchThing: Middleware = async (ctx, next) => {
  const {
    object: { id: thing },
  } = ctx.request.body

  const authFetch = await getAuthenticatedFetch()

  const response = await authFetch(thing)

  if (!response.ok) throw new Error('Not accessible')

  await next()
}

export const validateThing: Middleware = async (ctx, next) => {
  await next()
}

export const saveThing: Middleware = async ctx => {
  ctx.status = 201
}
