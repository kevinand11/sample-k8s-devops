import { ApiObject, Helm, HelmProps } from 'cdk8s'

import { K8sChart } from './k8sChart'

export interface K8sHelmProps extends Omit<HelmProps, 'releaseName'> { }

export interface K8sStaticHelmProps extends Omit<K8sHelmProps, 'chart' | 'version'> {}

export class K8sHelm extends Helm {
	constructor (scope: K8sChart, id: string, readonly props: K8sHelmProps) {
		super(scope, id, {
			namespace: scope.namespace,
			releaseName: scope.node.id,
			...props,
		})
	}

	getTypedObject<T extends ApiObject>(condition: (o: ApiObject) => boolean) : T | undefined {
		const objIdx = this.apiObjects.findIndex((o) => condition(o))
		if (objIdx === -1) return undefined
		const obj = this.apiObjects[objIdx]
		return obj as T

		/* this.node.tryRemoveChild(obj.node.id)
		const newObj = new constructor(this, obj.node.id, obj.toJson())
		obj.node.setContext(obj.node.id, newObj)
		this.apiObjects[objIdx] = newObj
		return newObj */
	}

	static certManager (scope: K8sChart, id: string, props: K8sStaticHelmProps) {
		return new K8sHelm(scope, id, {
			...props,
			chart: 'cert-manager',
			repo: 'https://charts.jetstack.io',
			version: 'v1.17.2',
		})
	}

	static traefik (scope: K8sChart, id: string, props: K8sStaticHelmProps) {
		return new K8sHelm(scope, id, {
			...props,
			chart: 'traefik',
			repo: 'https://traefik.github.io/charts',
			version: '35.1.0',
		})
	}

	static twingateOperator (scope: K8sChart, id: string, props: K8sStaticHelmProps) {
		return new K8sHelm(scope, id, {
			...props,
			chart: 'oci://ghcr.io/twingate/helmcharts/twingate-operator',
			version: '0.20.2',
		})
	}
}
