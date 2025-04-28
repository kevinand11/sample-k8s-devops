import { K8sChart } from './k8sChart'
import { K8sHelm, K8sHelmProps } from './k8sHelm'

export interface K8sCertManagerHelmProps extends Omit<K8sHelmProps, 'chart' | 'version'> {}

export class K8sCertManagerHelm extends K8sHelm {
  constructor (scope: K8sChart, id: string, props: K8sCertManagerHelmProps) {
    super(scope, id, {
      ...props,
      chart: 'cert-manager',
      repo: 'https://charts.jetstack.io',
      version: 'v1.17.2'
    })
  }
}