import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { Command } from 'commander'


import { K8sChart } from './k8sChart'
import { createFolderIfNotExists, exec, runWithTrials } from '../common/utils'

const toolFolder = path.resolve(process.cwd(), '.k8s-cdk')

export class K8sApp {
	command: Command

	constructor (private readonly charts: K8sChart[]) {
		const listCommand = new Command('list')
			.description('list charts')
			.action(async (options) => {
				const charts = this.#filterCharts(options)
				const data = charts.map((chart) => ({ Id: chart.node.id, Name: chart.constructor.name, Namespace: chart.namespace }))
				console.table(data)
			})

		const buildCommand = new Command('build')
			.description('build yaml representation of code')
			.action(async (options: BuildOptions) => {
				await createFolderIfNotExists(toolFolder)
				for (const chart of this.#filterCharts(options)) await this.#buildChart(chart, options)
			})

		const deployCommand = new Command('deploy')
			.description('deploy code changes to k8s cluster')
			.option('--fresh', 'run fresh installation', false)
			.option('--skip-image-builds', 'force skip image builds', false)
			.action(async (options: DeployOptions) => {
				for (const chart of this.#filterCharts(options)) await this.#deployChart(chart, options)
			})

		const diffCommand = new Command('diff')
			.description('show diff between code and k8s cluster')
			.action(async (options: DiffOptions) => {
				for (const chart of this.#filterCharts(options)) await this.#diffChart(chart, options)
			})

		const deleteCommand = new Command('delete')
			.description('delete chart')
			.requiredOption('--chart-id <value>', 'id of chart to delete')
			.action(async (options: DeleteOptions) => {
				const chart = this.#filterCharts(options).find((c) => c.node.id === options.chartId)
				if (chart) await this.#deleteChart(chart, options)
			})

		this.command = new Command('k8s-cli')
			.description('Cli to manage your k8s application')

		const commands = [listCommand, buildCommand, deployCommand, diffCommand, deleteCommand]
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

	async #buildChart (chart: K8sChart, _options: BuildOptions) {
		const filePath = path.resolve(toolFolder, `${chart.node.id}.yaml`)
		await fs.rm(filePath, { recursive: true, force: true })
		await chart.runHook('pre:build')
		const result = chart.app.synthYaml()
		await fs.writeFile(filePath, result)
		await chart.runHook('post:build')
		return result
	}

	async #deployChart (chart: K8sChart, options: DeployOptions) {
		const result = await this.#buildChart(chart, options)
		await chart.runHook('pre:deploy')
		if (!options.skipImageBuilds) {
			// TODO: how to use skip image builds
		}
		if (options.fresh) await this.#deleteChart(chart, { ...options, chartId: chart.node.id })
		const applySetName = `configmaps/${chart.namespace}-${chart.node.id}`
		await exec(`kubectl get ns ${chart.namespace} > /dev/null 2>&1 || kubectl create ns ${chart.namespace}`)
		await runWithTrials(
			async (trial: number) => {
				if (trial > 1) console.log('\n\n\n\n\nRetrying')
				await exec(`KUBECTL_APPLYSET=true kubectl apply --prune -n=${chart.namespace} --applyset=${applySetName} -f -`, result)
			},
			{ tries: 3, delayMs: 2000 }
		)
		await chart.runHook('post:deploy')
	}

	async #diffChart (chart: K8sChart, options: DiffOptions) {
		const result = await this.#buildChart(chart, options)
		await chart.runHook('pre:diff')
		await exec(`kubectl diff --prune -n=${chart.namespace} -f -`, result, true)
		await chart.runHook('post:diff')
	}

	async #deleteChart (chart: K8sChart, _options: DeleteOptions) {
		await chart.runHook('pre:delete')
		await exec(`kubectl delete ns ${chart.namespace} --wait --ignore-not-found`)
		await chart.runHook('post:delete')
	}
}

interface CommonOptions {
	include: string
	exclude: string
}

interface BuildOptions extends CommonOptions {}

interface DeployOptions extends CommonOptions {
	fresh: boolean
	skipImageBuilds: boolean
}

interface DiffOptions extends CommonOptions {}
interface DeleteOptions extends CommonOptions {
	chartId: string
}