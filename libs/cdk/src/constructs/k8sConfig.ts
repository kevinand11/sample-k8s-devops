import { EnvValue } from 'cdk8s-plus-32'
import { $, quote } from 'zx'

interface K8sConfigProps {
	name: string
	namespace?: string
	parent?: K8sConfig
}

type StringOrObject<T = string> = Record<string, T>

export class K8sConfig {
	private values: StringOrObject
	private constructor (private readonly props: K8sConfigProps) {
		if (!props.name) throw new Error('name if required for K8sEnv')
		if (props.namespace) $.sync`kubectl get namespace ${props.namespace} > /dev/null 2>&1 || kubectl create configmap ${props.namespace}`
		$.sync`kubectl get configmap ${this.#commonArgs} > /dev/null 2>&1 || kubectl create configmap ${this.#commonArgs}`
		const res = $.sync`kubectl get configmap ${this.props.name} ${this.#commonArgs} -o json`
		const values = res.json().data
		this.values = values
	}

	get #commonArgs () {
		const { name, namespace } = this.props
		return ['configmap', namespace ? `-n ${namespace}` : undefined, name].filter(Boolean).join(' ')
	}

	exportAsJSON () {
		return Object.freeze({ ...this.props.parent?.values, ...this.values })
	}

	exportAsEnv () {
		return Object.entries(this.exportAsJSON()).reduce((acc, [key, value]) => acc + `${key}=${value}\n`, '')
	}

	exportAsEnvValue () {
		return Object.fromEntries(
			Object.entries(this.exportAsJSON()).map(([key, value]) => [key, EnvValue.fromValue(value)])
		)
	}

	put(values: StringOrObject) {
		this.values = values
		$.sync`kubectl patch ${this.#commonArgs} --type merge -p ${quote(JSON.stringify(values))}`
	}

	putFromJSON(values: StringOrObject<string | StringOrObject>) {
		return this.put(Object.fromEntries(
			Object.entries(values).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value])
		))
	}

	static of (props: Pick<K8sConfigProps, 'name' | 'namespace'>) {
		return new K8sConfig(props)
	}

	scope (name: string) {
		return new K8sConfig({ ...this.props, name: `${this.props.name}.${name}`, parent: this  })
	}
}
