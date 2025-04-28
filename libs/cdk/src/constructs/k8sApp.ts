import { Command } from 'commander'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createFolderIfNotExists, exec } from '../common/utils'

import { K8sChart } from './k8sChart'
import { K8sConstruct } from './k8sConstruct'

const toolFolder = path.resolve(process.cwd(), '.k8s-cdk')

export class K8sApp {
	command: Command

	constructor (private readonly charts: K8sChart[]) {
		const listCommand = new Command('list')
			.description('list charts')
			.action(async (options) => {
				const charts = this.#filterCharts(options)
				const data = charts.map((chart) => ({ Id: chart.node.id, Name: chart.constructor.name, Namespace: chart.namespace  }))
				console.table(data)
			})

		const synthCommand = new Command('synth')
			.description('generate yaml representation of code')
			.action(async (options: SynthOptions) => {
				await fs.rm(toolFolder, { recursive: true, force: true })
				await createFolderIfNotExists(toolFolder)
				for (const chart of this.#filterCharts(options)) await this.#synthChart(chart, options)
			})

		const applyCommand = new Command('apply')
			.description('apply code changes to k8s cluster')
			.option('--fresh', 'run fresh installation', false)
			.option('--skip-image-builds', 'force skip image builds', false)
			.action(async (options: ApplyOptions) => {
				for (const chart of this.#filterCharts(options)) await this.#applyChart(chart, options)
			})

		const diffCommand = new Command('diff')
			.description('show diff between code and k8s cluster')
			.action(async (options: DiffOptions) => {
				for (const chart of this.#filterCharts(options)) await this.#diffChart(chart, options)
			})

		const deleteCommand = new Command('delete')
			.description('delete charts')
			.action(async (options: DeleteOptions) => {
				for (const chart of this.#filterCharts(options))  await this.#deleteChart(chart, options)
			})

		this.command = new Command('k8s-cli')
			.description('Cli to manage your k8s application')

		const commands = [listCommand, synthCommand, applyCommand, diffCommand, deleteCommand]
		commands.forEach((c) => {
			c
				.option('--include <include>', 'include charts in this list', '')
				.option('--exclude <exclude>', 'exclude charts in this list', '')
			this.command.addCommand(c)
		})
	}

	process () {
		this.command.parseAsync(process.argv)
	}

	#filterCharts (options: CommonOptions) {
		const include = options?.include?.split(',').filter(Boolean) ?? []
		const exclude = options?.exclude?.split(',').filter(Boolean) ?? []
		return this.charts.filter((chart) => {
			if (exclude.includes(chart.node.id)) return false
			if (!include.length) return true
			return include.includes(chart.node.id)
		})
	}

	async #synthChart (chart: K8sChart, options: SynthOptions, deploy = false) {
		const k8sNodes = chart.app.node.findAll().filter((node) => node instanceof K8sConstruct)
		if (deploy) await Promise.all(k8sNodes.map((node) => node.deploy()))
		const result = chart.app.synthYaml()
		await fs.writeFile(path.resolve(toolFolder, `${chart.node.id}.yaml`), result)
		return result
	}

	async #applyChart (chart: K8sChart, options: ApplyOptions) {
		const result = await this.#synthChart(chart, options, !options?.skipImageBuilds)
		if (options.fresh) await this.#deleteChart(chart, { ...options, chartId: chart.node.id }, result)
		// await exec(`kubectl apply --prune -l=${chart.selector} -f -`, result)
		const applySetName = `configmaps/${chart.namespace}-${chart.node.id}`
		await exec(`kubectl get ns ${chart.namespace} > /dev/null 2>&1 || kubectl create ns ${chart.namespace}`)
		await exec(`KUBECTL_APPLYSET=true kubectl apply --prune -n=${chart.namespace} --applyset=${applySetName} -f -`, result)
	}

	async #diffChart (chart: K8sChart, options: DiffOptions) {
		const result = await this.#synthChart(chart, options)
		// await exec(`kubectl diff --prune -l=${chart.selector} -f -`, result, true)
		await exec(`kubectl diff --prune -n=${chart.namespace} -f -`, result, true)
	}

	async #deleteChart (chart: K8sChart, options: DeleteOptions, res?: string) {
		// const result = res ?? await this.#synthChart(chart, options)
		// await exec(`kubectl delete -l=${chart.selector} --wait --ignore-not-found -f -`, result)
		await exec(`kubectl delete ns ${chart.namespace} --wait --ignore-not-found`)
	}
}

interface CommonOptions {
	include?: string
	exclude?: string
}

interface SynthOptions extends CommonOptions {}

interface ApplyOptions extends CommonOptions {
	fresh?: boolean
	skipImageBuilds?: boolean
}

interface DiffOptions extends CommonOptions {}
interface DeleteOptions extends CommonOptions {
	chartId: string
}