import { App, AppProps, IResolver, ResolutionContext } from 'cdk8s'
import { LocalDockerImage } from './localDockerImage'

export interface K8sAppProps {
	env: string
	infra?: boolean
	app?: AppProps
	applySetName?: string
	localDockerImages?: {
		synth?: boolean
	}
	quiet?: boolean
}

export class K8sApp extends App {
	constructor (private readonly props: K8sAppProps) {
		const resolvers = props.app?.resolvers ?? []
		// if (props.env && !props.infra) resolvers.push(new EnvPrefixResolver(props.env))
		super({ ...props.app, resolvers })
	}

	get env () {
		return this.props.env
	}

	get applySetName () {
		return this.props.applySetName ?? `${this.env}-apply-set`
	}

	async synth (disableExternal: boolean = false) {
		const dockerNodes = this.node.findAll().filter((node) => node instanceof LocalDockerImage)
		if (this.props.localDockerImages?.synth && !disableExternal) {
			await Promise.all(
				dockerNodes.map((node) => node.synth())
			)
		}

		super.synth()
	}
}

class EnvPrefixResolver implements IResolver {
  constructor(private readonly env: string) {}
  public resolve(context: ResolutionContext) {
    const isNameProperty = context.key.includes('metadata') && context.key.includes('name') && context.key.length === 2;
    const isPrefixed = typeof(context.value) === 'string' && context.value.startsWith(`${this.env}-`);
    if (isNameProperty && !isPrefixed) {
      context.replaceValue(`${this.env}-${context.value}`);
    }
  }

}