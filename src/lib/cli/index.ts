import { Command } from 'commander'
import { exec } from '../common/utils'
import { K8sApp } from '../constructs'

export function createCli (app: K8sApp) {
	const program = new Command()

	const greetCommand = new Command()
		.command('greet')
		.description('Greet the user')
		.action(async () => {
			console.log('Hello, folks:')
		})

	const synthCommand = new Command()
		.command('synth')
		.description('Build cdk8s into yaml in dist folder')
		.action(async () => {
			await app.synth(true)
		})

	const deployCommand = new Command()
		.command('deploy')
		.description('Deploy to environment')
		.action(async () => {
			await app.synth()
			await exec('kubectl', ['create', 'ns', app.env]).catch(() => {})
			await exec('KUBECTL_APPLYSET=true kubectl', ['apply', '--prune', `-n=${app.env}`, `--applyset=${app.applySetName}`, '-f', app.outdir!])
		})

	const diffCommand = new Command()
		.command('diff')
		.description('Show diff between code and deployed cluster')
		.action(async () => {
			await app.synth(true)
			await exec('kubectl', ['diff', '--prune', `-n=${app.env}`, '-f', app.outdir!])
		})

	program
		.addCommand(greetCommand)
		.addCommand(synthCommand)
		.addCommand(deployCommand)
		.addCommand(diffCommand)
		.parseAsync(process.argv)
}