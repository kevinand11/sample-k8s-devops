import { App, Chart } from 'cdk8s'

import { K8sConstruct } from './k8sConstruct'
import { AddK8sHooks, K8sConstructHook } from './k8sHooks'

export interface K8sChartProps {
	namespace: string
}

const labelKey = 'k8s.chart.scope'

export class K8sChart extends AddK8sHooks(Chart) {
	readonly app: App
	readonly namespace: string

	constructor (id: string, props: K8sChartProps) {
		const app = new App()
		super(app, id, {
			disableResourceNameHashes: true,
			labels: { [labelKey]: `${props.namespace}.${id}` }
		})
		this.namespace = props.namespace
		this.app = app
	}

	get selector () {
		return `${labelKey}=${this.labels[labelKey]}`
	}

	resolve (name: string) {
		return `${this.node.id}-${name}`
	}

	resolveDns (name: string) {
		return `${name}.${this.namespace}.svc.cluster.local`
	}

	async runHook (hook: K8sConstructHook) {
		const nodes = this.app.node.findAll().filter((node) => node instanceof K8sConstruct)
		for (const node of nodes) await node.runHook(hook)
		super.runHook(hook)
	}
}