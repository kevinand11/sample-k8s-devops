import { Helm, HelmProps } from 'cdk8s'
import { K8sChart } from './k8sChart'

export interface K8sHelmProps extends Omit<HelmProps, 'releaseName'> {}

export class K8sHelm extends Helm {
	constructor (scope: K8sChart, id: string, readonly props: K8sHelmProps) {
		super(scope, id, {
			...props,
			releaseName: scope.node.id,
			namespace: scope.namespace,
		})
	}
}
