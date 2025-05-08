import { Config, K8sConfigAdapter } from '@devops/k8s-cdk'

const rootConfig = Config.of({
	adapter: new K8sConfigAdapter({ name: 'stranerd', namespace: 'stranerd-envs', secret: true })
})

export const devopsConfig = rootConfig.scope('devops')
export const apiConfig = rootConfig.scope('api')
export const clientConfig = rootConfig.scope('client')