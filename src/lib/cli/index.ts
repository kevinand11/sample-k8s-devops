import { Command } from 'commander'
import { exec } from '../common/utils'
import { K8sApp } from '../constructs'

export function createCli (app: K8sApp) {
	const program = new Command()

	const synthCommand = new Command()
		.command('synth')
		.description('generate yaml representation of code')
		.option('-q --quiet', 'silent', false)
		.action(async (options) => {
			const result = await app.synth(true)
			if (!options?.quiet) console.log(result)
		})

	const applyCommand = new Command()
		.command('apply')
		.description('apply code changes to k8s cluster')
		.option('--fresh', 'run fresh installation', false)
		.option('--skip-image-builds', 'force skip image builds', false)
		.action(async (options) => {
			const result = await app.synth(!options?.skipImageBuilds)
			if (options.fresh) await exec(`kubectl delete ns ${app.namespace} || true`)
			await exec(`kubectl get ns ${app.namespace} > /dev/null 2>&1 || kubectl create ns ${app.namespace}`)
			await exec(`KUBECTL_APPLYSET=true kubectl apply --prune -n=${app.namespace} --applyset=${app.applySetName} -f -`, result)
		})

	const diffCommand = new Command()
		.command('diff')
		.description('show diff between code and k8s cluster')
		.action(async () => {
			const result = await app.synth(true)
			await exec(`kubectl diff --prune -n=${app.namespace} -f -`, result, true)
		})

	program
		.addCommand(synthCommand)
		.addCommand(applyCommand)
		.addCommand(diffCommand)
		.parseAsync(process.argv)
}