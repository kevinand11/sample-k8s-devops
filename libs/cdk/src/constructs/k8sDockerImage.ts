import { DockerImage, DockerImageProps } from '../entities'
import { K8sChart } from './k8sChart'
import { K8sConstruct } from './k8sConstruct'

export interface Ks8DockerImageProps extends DockerImageProps {}

export class K8sDockerImage extends K8sConstruct {
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
