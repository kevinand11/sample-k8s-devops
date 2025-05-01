import { Construct } from 'constructs'

import { DockerImage, DockerImageProps } from '../entities'
import { K8sChart } from './k8sChart'
import { AddK8sHooks, K8sConstructHook, K8sConstructHookCallback } from './k8sHooks'

export interface Ks8DockerImageProps extends DockerImageProps {
	hooks?: Partial<Record<K8sConstructHook, K8sConstructHookCallback>>
}

export class K8sDockerImage extends AddK8sHooks(Construct) {
	readonly image: DockerImage
	constructor (scope: K8sChart, id: string, { hooks ,...props }: Ks8DockerImageProps) {
		super(scope, id)

		this.image = new DockerImage(props)

		Object.entries(hooks ?? {}).forEach(([hook, cb]) => this.addHook(hook as K8sConstructHook, cb))
		if (process.env.K8S_ADD_DOCKER_IMAGE_BUILD_AND_DEPLOY_HOOK) this.addHook('pre:deploy', async () => {
			await this.image.build()
			await this.image.push()
		})
	}
}
