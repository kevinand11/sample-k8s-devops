import { randomUUID } from 'node:crypto'

import { ApiObject, Helm, HelmProps } from 'cdk8s'

import { K8sChart } from './k8sChart'
import { K8sConstruct } from './k8sConstruct'

export interface K8sHelmProps extends Omit<HelmProps, 'releaseName'> { }

export interface K8sStaticHelmProps extends Omit<K8sHelmProps, 'chart' | 'version'> {}

const versions = {
	certManager: '1.17.2',
	gateway: '1.3.0',
	traefik: '35.2.0',
	twingateOperator: '0.20.2',
}

export class K8sHelm extends K8sConstruct {
	private helm?: Helm
	constructor (private readonly scope: K8sChart, private readonly id: string, private readonly props: K8sHelmProps) {
		super(scope, id)
	}

	get apiObjects () {
		if (!this.helm) this.helm = new Helm(this.scope, `${this.id}-include-${randomUUID()}`, {
			namespace: this.scope.namespace,
			releaseName: this.scope.node.id,
			...this.props,
		})
		return this.helm.apiObjects
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
			version: versions.certManager,
		})
	}

	static traefik (scope: K8sChart, id: string, props: K8sStaticHelmProps) {
		return new K8sHelm(scope, id, {
			...props,
			chart: 'traefik',
			repo: 'https://traefik.github.io/charts',
			version: versions.traefik,
		})
	}

	static twingateOperator (scope: K8sChart, id: string, props: K8sStaticHelmProps) {
		return new K8sHelm(scope, id, {
			...props,
			chart: 'oci://ghcr.io/twingate/helmcharts/twingate-operator',
			version: versions.twingateOperator,
		})
	}
}


export class K8sCRDs {
	static certManager () {
		return [`https://github.com/cert-manager/cert-manager/releases/download/v${versions.certManager}/cert-manager.crds.yaml`]
	}

	static gateway () {
		return [`https://github.com/kubernetes-sigs/gateway-api/releases/download/v${versions.gateway}/standard-install.yaml`]
	}

	static traefik () {
		const crdFiles = ['ingressroutes', 'ingressroutetcps', 'ingressrouteudps', 'middlewares', 'middlewaretcps', 'serverstransports', 'serverstransporttcps', 'tlsoptions', 'tlsstores', 'traefikservices']
		return crdFiles.map((file) => `https://github.com/traefik/traefik-helm-chart/raw/refs/tags/v${versions.traefik}/traefik-crds/crds-files/traefik/traefik.io_${file}.yaml`)
	}

	static traefikHub () {
		const crdFiles= ['accesscontrolpolicies', 'aiservices', 'apibundles', 'apicatalogitems', 'apiplans', 'apiportals', 'apiratelimits', 'apis', 'apiversions', 'managedsubscriptions']
		return crdFiles.map((file) => `https://github.com/traefik/traefik-helm-chart/raw/refs/tags/v${versions.traefik}/traefik-crds/crds-files/hub/hub.traefik.io_${file}.yaml`)
	}

	static twingateOperator () {
		const crdFiles = ['connector', 'group', 'resources', 'resourceaccesses']
		return crdFiles.map((file) => `https://raw.githubusercontent.com/Twingate/kubernetes-operator/refs/tags/v${versions.twingateOperator}/deploy/twingate-operator/crds/twingate.com.twingate${file}.yaml`)
	}
}