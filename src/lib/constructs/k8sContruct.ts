import { Construct } from 'constructs'
import { K8sApp } from './k8sApp'

export class K8sConstruct extends Construct {
	constructor (scope: K8sApp, id: string) {
		super(scope, id)
	}

	get env () {
		return (this.node.root as K8sApp).env
	}
}