import { Command } from 'commander'
import { exec } from '../common/utils'
import { K8sApp } from '../constructs'

export function createCli (app: K8sApp) {
	const program = new Command()

	const synthCommand = new Command()
		.command('synth')
		.description('Generate yaml representation of code')
		.action(async () => {
			const result = await app.synth(true)
			console.log(result)
		})

	const applyCommand = new Command()
		.command('apply')
		.description('Apply code changes to k8s cluster')
		.action(async () => {
			const result = await app.synth()
			await exec(`kubectl get namespace ${app.env} || kubectl create namespace ${app.env}`)
			await exec(`KUBECTL_APPLYSET=true kubectl apply --prune -n=${app.env} --applyset=${app.applySetName} -f -`, result)
		})

	const diffCommand = new Command()
		.command('diff')
		.description('Show diff between code and k8s cluster')
		.action(async () => {
			const result = await app.synth(true)
			await exec(`kubectl diff --prune -n=${app.env} -f -`, result, true)
		})

	program
		.addCommand(synthCommand)
		.addCommand(applyCommand)
		.addCommand(diffCommand)
		.parseAsync(process.argv)
}