import { Middleware } from 'koa'
import * as config from '../config/index.js'

export type AppConfig = typeof config

export const loadConfig: (
  config: AppConfig,
) => Middleware<{ config: AppConfig }> = config => async (ctx, next) => {
  ctx.state.config = config
  await next()
}
