import { K8sConfig } from '@devops/k8s-cdk/k8s'

const namespace = 'stranerd-envs'

export const devopsConfig = K8sConfig.of({ name: 'stranerd.devops', namespace, secret: true })
export const apiConfig = K8sConfig.of({ name: 'stranerd.api', namespace, secret: true })
export const clientConfig = K8sConfig.of({ name: 'stranerd.client', namespace, secret: true })
