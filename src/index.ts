import { createApp } from './app.js'
import * as config from './config/index.js'

createApp(config).then(app =>
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`geoindex service is listening on port ${config.port}`)
  }),
)
