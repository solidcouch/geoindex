/* eslint-disable no-console */
import { CronJob } from 'cron'
import { createApp } from './app.js'
import {
  allowedGroups,
  database,
  indexedGroups,
  isBehindProxy,
  port,
  refreshSchedule,
  thingTypes,
  webId,
} from './config/index.js'
import { refreshIndex } from './tasks/refreshIndex.js'

createApp({
  port,
  indexedGroups,
  webId,
  thingTypes,
  isBehindProxy,
  allowedGroups,
  database,
}).then(app =>
  app.listen(port, async () => {
    console.log(`geoindex service is listening on port ${port}`)

    // run the refresh once, then schedule the job
    try {
      await refreshIndex(indexedGroups, webId, thingTypes)
      console.log('index refreshed')
    } catch (e) {
      console.log('index refreshing failed', e)
    } finally {
      console.log('scheduling jobs')
      new CronJob(
        refreshSchedule,
        async () => {
          await refreshIndex(allowedGroups, webId, thingTypes)
        },
        () => {
          console.log('refresh of the index completed')
        },
        true,
      )
      console.log('jobs scheduled')
    }
  }),
)
