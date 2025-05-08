import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { exec, execSync, upsertNamespace } from '../../common/utils'

export abstract class ConfigAdapter {
	abstract load (scope: string | undefined): Promise<Record<string, string>>
	abstract save (values: Record<string, string>, scope: string | undefined): Promise<void>
}

interface K8sConfigProps {
	name: string
	namespace?: string
	secret?: boolean
}

export class K8sConfigAdapter extends ConfigAdapter {
	constructor (private props: K8sConfigProps) {
		super()
	}

	#commonArgs (scope: string | undefined) {
		const { name, namespace, secret: encrypted } = this.props
		const fullName = [name, scope].filter(Boolean).join('.')
		return [encrypted ? 'secret' : 'configmap', namespace ? `-n=${namespace}` : undefined, fullName].filter(Boolean).join(' ')
	}

	async load (scope) {
		if (this.props.namespace) upsertNamespace(this.props.namespace)
		let createCommonArgs = this.#commonArgs(scope)
		if (createCommonArgs.startsWith('secret ')) createCommonArgs = `secret generic ${createCommonArgs.slice(6)}`
		execSync(`kubectl get ${this.#commonArgs} > /dev/null 2>&1 || kubectl create ${createCommonArgs}`)
		const res = execSync(`kubectl get ${this.#commonArgs} -o json`)
		const values = JSON.parse(res).data as Record<string, string>
		return Object.fromEntries(
			Object.entries(values).map(([key, value]) => [key, this.props.secret ? Buffer.from(value, 'base64').toString('utf-8') : value])
		)
	}

	async save(values, scope) {
		const filePath = path.resolve(os.tmpdir(), '.k8s', crypto.randomUUID())
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(filePath, JSON.stringify({ [this.props.secret ? 'stringData' : 'data']: values }))
		await exec(`kubectl patch ${this.#commonArgs(scope)} --type merge --patch-file ${filePath}`)
		await fs.rm(filePath, { force: true })
	}
}

export class FileConfigAdapter extends ConfigAdapter {
	constructor (private filePath: string) {
		super()
	}

	#fullFilePath (scope) {
		const parsed = path.parse(this.filePath)
		const fullName = [parsed.name, scope].filter(Boolean).join('-')
		return path.join(parsed.dir, `${fullName}${parsed.ext}`)
	}

	async load (scope) {
		const fileContent = (await fs.readFile(this.#fullFilePath(scope)).catch(() => '{}')).toString()
		return JSON.parse(fileContent)
	}

	async save (values, scope) {
		const fullPath = this.#fullFilePath(scope)
		await fs.mkdir(path.dirname(fullPath), { recursive: true })
		await fs.writeFile(fullPath, values)
	}
}