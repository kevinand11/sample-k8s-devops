import { apiConfig, clientConfig } from '.'

// TODO: never run this file willy-nilly

apiConfig.putFromJSON(require('./configs/api/index.json'))
apiConfig.child('dev').putFromJSON(require('./configs/api/dev.json'))

clientConfig.putFromJSON(require('./configs/client/index.json'))
clientConfig.child('dev').putFromJSON(require('./configs/client/dev.json'))