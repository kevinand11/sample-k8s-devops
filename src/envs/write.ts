import { apiConfig, clientConfig, devopsConfig } from '.'

// TODO: never run this file willy-nilly.. it is an example of how to update env values

devopsConfig.setJson(require('./configs/devops.json')).save()

apiConfig.setJson(require('./configs/api/index.json')).save
apiConfig.scope('dev').setJson(require('./configs/api/dev.json')).save()

clientConfig.setJson(require('./configs/client/index.json')).save()
clientConfig.scope('dev').setJson(require('./configs/client/dev.json')).save()