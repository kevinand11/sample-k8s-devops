import { App, Chart } from 'cdk8s'
import { Namespace } from 'cdk8s-plus-32'

export interface K8sChartProps {
	namespace: string
}

const labelKey = 'k8s.chart.scope'

export class K8sChart extends Chart {
	readonly app: App
	readonly namespace: string

	constructor (id: string, props: K8sChartProps) {
		const app = new App()
		super(app, id, {
			disableResourceNameHashes: true,
			labels: { [labelKey]: `${props.namespace}-${id}` }
		})
		new Namespace(this, `${props.namespace}-namespace`, {
			metadata: { name: props.namespace }
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
}