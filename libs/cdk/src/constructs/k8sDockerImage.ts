import { Construct } from 'constructs'

import { DockerImage, DockerImageProps } from '../entities'
import { K8sChart } from './k8sChart'
import { AddK8sHooks } from './k8sHooks'

export interface Ks8DockerImageProps extends DockerImageProps {}

export class K8sDockerImage extends AddK8sHooks(Construct) {
	readonly image: DockerImage
	constructor (scope: K8sChart, id: string, props: Ks8DockerImageProps) {
		super(scope, id)

		this.image = new DockerImage(props)

		this.addHook('pre:deploy', async () => {
			await this.image.build()
			await this.image.push()
		})
	}
}
