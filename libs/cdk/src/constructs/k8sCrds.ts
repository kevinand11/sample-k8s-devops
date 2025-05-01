import { Include } from 'cdk8s'

import { K8sChart } from './k8sChart'

export class K8sCRDs {
	static gateway (scope: K8sChart, id: string) {
		return new Include(scope, id, { url: 'https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml' })
	}

	static twingate (scope: K8sChart, id: string) {
		// TODO: replace with right url
		return new Include(scope, id, { url: 'https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml' })
	}
}