import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { EnvValue } from 'cdk8s-plus-32'

import { execSync } from '../common/utils'


interface K8sConfigProps {
	name: string
	namespace?: string
	secret?: boolean
	parent?: K8sConfig
}

type StringOrObject<T = string> = Record<string, T>

export class K8sConfig {
	private values: StringOrObject
	private constructor (private readonly props: K8sConfigProps) {
		if (!props.name) throw new Error('name is required for K8sEnv')
		if (props.namespace) execSync(`kubectl get ns ${props.namespace} > /dev/null 2>&1 || kubectl create ns ${props.namespace}`)
		let createCommonArgs = this.#commonArgs
		if (createCommonArgs.startsWith('secret ')) createCommonArgs = `secret generic ${createCommonArgs.slice(6)}`
		execSync(`kubectl get ${this.#commonArgs} > /dev/null 2>&1 || kubectl create ${createCommonArgs}`)
		const res = execSync(`kubectl get ${this.#commonArgs} -o json`)
		const values = JSON.parse(res).data
		this.values = values
	}

	get #commonArgs () {
		const { name, namespace, secret: encrypted } = this.props
		return [encrypted ? 'secret' : 'configmap', namespace ? `-n=${namespace}` : undefined, name].filter(Boolean).join(' ')
	}

	get<T = string>(name: string, parser?: (val: string) => T) {
		const value = this.exportAsJSON()[name]
		if (!parser) return value
		if (value === undefined) throw new Error(`${name} not found in config values`)
		return parser(value)
	}

	exportAsJSON (): Readonly<StringOrObject> {
		const values = Object.fromEntries(
			Object.entries(this.values).map(([key, value]) => [key, this.props.secret ? Buffer.from(value, 'base64').toString('utf-8') : value])
		)
		return Object.freeze({
			...(this.props.parent?.exportAsJSON()),
			...values
		})
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
		const filePath = path.resolve(os.tmpdir(), '.k8s', crypto.randomUUID())
		mkdirSync(path.dirname(filePath), { recursive: true })
		writeFileSync(filePath, JSON.stringify({ [this.props.secret ? 'stringData' : 'data']: values }))
		execSync(`kubectl patch ${this.#commonArgs} --type merge --patch-file ${filePath}`)
		rmSync(filePath, { force: true })
	}

	putFromJSON(values: StringOrObject<string | StringOrObject[] | StringOrObject>) {
		return this.put(Object.fromEntries(
			Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
		))
	}

	static of (props: Omit<K8sConfigProps, 'parent'>) {
		return new K8sConfig(props)
	}

	scope (name: string) {
		return new K8sConfig({ ...this.props, name: `${this.props.name}.${name}`, parent: this  })
	}
}
