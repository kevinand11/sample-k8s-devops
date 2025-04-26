import { App, AppProps, IResolver, ResolutionContext } from 'cdk8s'
import { createCli } from '../cli'
import { LocalDockerImage } from './localDockerImage'

export interface K8sAppProps {
	env: string
	app?: AppProps
	applySetName?: string
}

export class K8sApp extends App {
	constructor (private readonly props: K8sAppProps) {
		const resolvers = props.app?.resolvers ?? []
		super({ ...props.app, resolvers })
	}

	get env () {
		return this.props.env
	}

	get namespace () {
		return this.env
	}

	get applySetName () {
		return this.props.applySetName ?? `${this.env}-apply-set`
	}

	async synth (skipExternalSynths: boolean = false) {
		const dockerNodes = this.node.findAll().filter((node) => node instanceof LocalDockerImage)
		if (!skipExternalSynths) {
			await Promise.all(
				dockerNodes.map((node) => node.synth())
			)
		}

		return super.synthYaml()
	}

	async process () {
		await createCli(this)
	}
}
