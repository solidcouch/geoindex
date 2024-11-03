/* eslint-disable no-console */
import { CronJob } from 'cron'
import { createApp } from './app.js'
import * as config from './config/index.js'
import { refreshIndex } from './tasks/refreshIndex.js'

createApp(config).then(app =>
  app.listen(config.port, async () => {
    console.log(`geoindex service is listening on port ${config.port}`)

    // run the refresh once, then schedule the job
    try {
      await refreshIndex(config.indexedGroups, config.webId, config.thingTypes)
      console.log('index refreshed')
    } catch (e) {
      console.log('index refreshing failed', e)
    } finally {
      console.log('scheduling jobs')
      new CronJob(
        config.refreshSchedule,
        async () => {
          await refreshIndex(
            config.allowedGroups,
            config.webId,
            config.thingTypes,
          )
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
