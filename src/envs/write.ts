import { apiConfig, clientConfig, devopsConfig } from '.'

// TODO: never run this file willy-nilly.. it is an example of how to update env values

devopsConfig.putFromJSON(require('./configs/devops.json'))

apiConfig.putFromJSON(require('./configs/api/index.json'))
apiConfig.scope('dev').putFromJSON(require('./configs/api/dev.json'))

clientConfig.putFromJSON(require('./configs/client/index.json'))
clientConfig.scope('dev').putFromJSON(require('./configs/client/dev.json'))