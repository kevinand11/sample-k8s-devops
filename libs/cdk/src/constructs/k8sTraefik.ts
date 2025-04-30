
import { K8sChart } from './k8sChart'
import { K8sHelm, K8sHelmProps } from './k8sHelm'

export interface K8sTraefikHelmProps extends Omit<K8sHelmProps, 'chart' | 'version'> {}

export class K8sTraefikHelm extends K8sHelm {
  constructor (scope: K8sChart, id: string, props: K8sTraefikHelmProps) {
    super(scope, id, {
      ...props,
      chart: 'traefik',
      repo: 'https://traefik.github.io/charts',
      version: '35.1.0',
    })
  }
}