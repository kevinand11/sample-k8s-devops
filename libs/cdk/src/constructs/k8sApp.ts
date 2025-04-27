import { Command } from 'commander'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { createFolderIfNotExists, exec } from '../common/utils'

import { K8sChart } from './k8sChart'
import { K8sConstruct } from './k8sConstruct'

const toolFolder = path.resolve(process.cwd(), '.k8s-cdk')

export class K8sApp {
	command: Command

	constructor (private readonly charts: K8sChart[]) {
		const synthCommand = new Command()
			.command('synth')
			.description('generate yaml representation of code')
			.option('-q --quiet', 'silent', false)
			.action(async (options) => {
				for (const chart of this.charts) await this.#synthChart(chart, options)
			})

		const applyCommand = new Command()
			.command('apply')
			.description('apply code changes to k8s cluster')
			.option('--fresh', 'run fresh installation', false)
			.option('--skip-image-builds', 'force skip image builds', false)
			.action(async (options) => {
				for (const chart of this.charts) await this.#applyChart(chart, options)
			})

		const diffCommand = new Command()
			.command('diff')
			.description('show diff between code and k8s cluster')
			.action(async (options) => {
				for (const chart of this.charts) await this.#diffChart(chart, options)
			})

		this.command = new Command()
			.addCommand(synthCommand)
			.addCommand(applyCommand)
			.addCommand(diffCommand)
	}

	process () {
		fs.rm(toolFolder, { recursive: true, force: true }).then(async () => {
			await createFolderIfNotExists(toolFolder)
			await this.command.parseAsync(process.argv)
		})
	}

	async #synthChart (chart: K8sChart, options: SynthOptions, deploy = false) {
		const k8sNodes = chart.app.node.findAll().filter((node) => node instanceof K8sConstruct)
		if (deploy) await Promise.all(k8sNodes.map((node) => node.deploy()))
		const result = chart.app.synthYaml()
		await fs.writeFile(path.resolve(toolFolder, `${chart.chart.node.id}.yaml`), result)
		return result
	}

	async #applyChart (chart: K8sChart, options: ApplyOptions) {
		const result = await this.#synthChart(chart, { quiet: true }, !options?.skipImageBuilds)
		if (options.fresh) await exec(`kubectl delete ns ${chart.namespace} || true`)
		await exec(`kubectl get ns ${chart.namespace} > /dev/null 2>&1 || kubectl create ns ${chart.namespace}`)
		await exec(`KUBECTL_APPLYSET=true kubectl apply --prune -n=${chart.namespace} --applyset=${chart.applySetName} -f -`, result)
	}

	async #diffChart (chart: K8sChart, options: DiffOptions) {
		const result = await this.#synthChart(chart, { quiet: true })
		await exec(`kubectl diff --prune -n=${chart.namespace} -f -`, result, true)
	}
}

type SynthOptions = {
	quiet?: boolean
}

type ApplyOptions = {
	fresh?: boolean
	skipImageBuilds?: boolean
}

type DiffOptions = {}