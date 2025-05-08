
import { ConfigMap, Secret } from 'cdk8s-plus-32'

import { ConfigAdapter } from './adapters'
import { EnvFromSource } from '../../../imports/k8s'
import { resolvePromiseSynchronously } from '../../common/utils'
import { K8sChart } from '../../constructs/k8sChart'

export * from './adapters'


interface K8sConfigProps {
	scope?: string
	parent?: Config
	adapter: ConfigAdapter
}

type StringOrObject<T = string> = Record<string, T>

export class Config {
	#values: Promise<StringOrObject>
	private constructor (private readonly props: K8sConfigProps) {
		this.#values = this.props.adapter.load(this.props.scope)
	}

	get<T = string>(name: string, parser?: (val: string) => T) {
		const value = this.toJSON()[name]
		if (!parser) return value
		if (value === undefined) throw new Error(`${name} not found in config values`)
		return parser(value)
	}

	toJSON (): Readonly<StringOrObject> {
		const values = resolvePromiseSynchronously(this.#values)
		return Object.freeze({
			...(this.props.parent?.toJSON()),
			...values
		})
	}

	toEnv () {
		return Object.entries(this.toJSON()).reduce((acc, [key, value]) => acc + `${key}=${value}\n`, '')
	}

	toEnvSource (scope: K8sChart, id: string, secret?: boolean) :EnvFromSource {
		const typeConstructor = secret ? Secret : ConfigMap
		const typeValue = new typeConstructor(scope, id, { stringData: this.toJSON() })
		const ref = { name: typeValue.name }
		return { [secret ? 'secretRef' : 'configMapRef']: ref }
	}

	async save () {
		this.props.adapter.save(await this.#values, this.props.scope)
	}

	static of (props: Omit<K8sConfigProps, 'parent' | 'scope'>) {
		return new Config(props)
	}

	scope (scope: string) {
		return new Config({
			...this.props,
			scope,
			parent: this,
		})
	}
}