import { Helm, HelmProps } from 'cdk8s'
import { Construct } from 'constructs'
import { K8sApp } from './k8sApp'

export interface K8sHelmProps extends Omit<HelmProps, 'releaseName'> {}

export class K8sHelm extends Helm {
	constructor (scope: Construct, id: string, private readonly props: K8sHelmProps) {
		super(scope, id, {
			...props,
			releaseName: scope.node.id,
			namespace: (scope.node.root as K8sApp).namespace,
		})
	}
}
