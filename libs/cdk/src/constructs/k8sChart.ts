import { App, Chart, ChartProps } from 'cdk8s'
import { Namespace } from 'cdk8s-plus-32'
import { Construct } from 'constructs'

export interface K8sChartProps extends ChartProps {
	namespace: string
}

const labelKey = 'k8s.chart.scope'

export class K8sChart extends Construct {
	readonly app: App
	readonly chart: Chart
	readonly #props: K8sChartProps

	constructor (readonly id: string, props: K8sChartProps) {
		const app = new App()
		const chart = new Chart(app, id, {
			...props,
			disableResourceNameHashes: true,
			labels: { [labelKey]: `${props.namespace}-${id}` }
		})
		new Namespace(chart, `${props.namespace}-namespace`, {
			metadata: { name: props.namespace }
		 })
		super(chart, id)
		this.#props = props
		this.app = app
		this.chart = chart
	}

	get namespace () {
		return this.#props.namespace
	}

	get selector () {
		return `${labelKey}=${this.chart.labels[labelKey]}`
	}

	resolve (name: string) {
		return `${this.node.id}-${name}`
	}
}