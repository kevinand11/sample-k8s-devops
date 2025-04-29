import { Include } from 'cdk8s'
import { K8sChart } from './k8sChart'

export class K8sGatewayCRDs extends Include {
	constructor (scope: K8sChart, id: string) {
    	super(scope, id, { url: 'https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml' })
	}
}