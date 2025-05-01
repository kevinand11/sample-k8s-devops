import { App, Chart } from 'cdk8s'

import { AddK8sHooks, K8sConstructHook, SupportsK8sHooks } from './k8sHooks'

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

	async runHook (hook: K8sConstructHook) {
		const nodes = this.app.node.findAll().filter((node) => SupportsK8sHooks(node))
		for (const node of nodes) await node.runHook(hook)
		super.runHook(hook)
	}
}