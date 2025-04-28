import { exec } from '../common/utils'
import { K8sChart } from './k8sChart'
import { K8sConstruct } from './k8sConstruct'

export class K8sDockerPlatform {
	readonly platform: string;
	private constructor (platform: string) {
		this.platform = platform
	}

	static LINUX_AMD64 = new K8sDockerPlatform('linux/amd64')
	static LINUX_ARM64 = new K8sDockerPlatform('linux/arm64')

	static custom (platform: string) {
		return new K8sDockerPlatform(platform)
	}
}

export interface LocalDockerImageProps {
	name: string
	tag?: string
	build: string | {
		context: string
		file?: string
		target?: string
		platforms?: K8sDockerPlatform[]
		args?: Record<string, string>
		tags?: Record<string, string>
	}
}

export class K8sDockerImage extends K8sConstruct {
	constructor (scope: K8sChart, id: string, private readonly props: LocalDockerImageProps) {
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

	async #build () {
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

		await exec(['docker', 'buildx', 'build', ...args, path].join(' '))
	}

	async #push () {
		await exec(`docker image push ${this.nameTag}`)
	}

	async deploy () {
		await this.#build()
		await this.#push()
	}
}
