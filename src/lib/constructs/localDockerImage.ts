import { Platform } from '../common'
import { exec } from '../common/utils'
import { K8sApp } from './k8sApp'
import { K8sConstruct } from './k8sContruct'

export interface LocalDockerImageProps {
	name: string
	tag?: string
	build: string | {
		context: string
		file?: string
		target?: string
		platforms?: Platform[]
		args?: Record<string, string>
		tags?: Record<string, string>
	}
}

export class LocalDockerImage extends K8sConstruct {
	constructor (scope: K8sApp, id: string, private readonly props: LocalDockerImageProps) {
		super(scope, id)
	}

	get name () {
		return this.props.name
	}

	get tag () {
		return this.props.tag ?? 'latest'
	}

	get nameTag () {
		return `${this.name}:${this.tag}`
	}

	async build () {
		const build = this.props.build
		const args: string[] = []
		const path = typeof build === 'object' ? build.context : build
		if (typeof build === 'object') {
			if (build.file) args.push('--file', build.file)
			if (build.target) args.push('--target', build.target)
			if (build.platforms && build.platforms.length > 0) args.push('--platform', build.platforms.map((p) => p.platform).join(','))
			if (build.args) Object.entries(build.args).forEach(([key, val]) => args.push('--build-arg', `${key}=${val}`))

			const tags = build.tags ?? {}
			tags[this.name] = this.tag
			Object.entries(tags).forEach(([name, tag]) => args.push('--tag', `${name}:${tag}`))
		}

		await exec('docker', ['buildx', 'build', ...args, path])
	}

	async deploy () {
		const args = ['image', 'push', this.nameTag]
		await exec('docker', args)
	}

	async synth () {
		await this.build()
		await this.deploy()
	}
}
