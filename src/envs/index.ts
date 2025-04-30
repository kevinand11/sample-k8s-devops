import { K8sConfig } from '@devops/k8s-cdk/k8s'

const namespace = 'envs'

export const devopsConfig = K8sConfig.of({ name: 'stranerd.devops', namespace })
export const apiConfig = K8sConfig.of({ name: 'stranerd.api', namespace })
export const clientConfig = K8sConfig.of({ name: 'stranerd.client', namespace })
