import { App, Chart, ChartProps } from 'cdk8s'
import { Construct } from 'constructs'

export interface K8sChartProps extends ChartProps {
	namespace: string
	applySetName?: string
}

export class K8sChart extends Construct {
	readonly app: App
	readonly chart: Chart
	readonly #props: K8sChartProps

	constructor (readonly id: string, props: K8sChartProps) {
		const app = new App()
		const chart = new Chart(app, id, {
			...props,
			disableResourceNameHashes: true,
		})
		super(chart, id)
		this.#props = props
		this.app = app
		this.chart = chart
	}

	get namespace () {
		return this.#props.namespace
	}

	get applySetName () {
		return this.#props.applySetName ?? `${this.#props.namespace}-${this.chart.node.id}-apply-set`
	}

	getFullName (name: string) {
		return `${this.node.id}-${name}`
	}
}