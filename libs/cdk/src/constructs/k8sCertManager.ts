import { K8sChart } from './k8sChart'
import { K8sHelm, K8sHelmProps } from './k8sHelm'

export interface K8sCertManagerHelmProps extends Omit<K8sHelmProps, 'chart' | 'version'> {}

export class K8sCertManagerHelm extends K8sHelm {
  constructor (scope: K8sChart, id: string, props: K8sCertManagerHelmProps) {
    super(scope, id, {
      ...props,
      chart: 'oci://registry-1.docker.io/bitnamicharts/cert-manager',
      version: '1.4.14',
    })
  }
}