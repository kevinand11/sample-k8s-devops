import path from 'path'

import { DockerImage, DockerPlatform } from '@devops/k8s-cdk'

import { getRequiredProcessEnv } from '../utils'

const tag = getRequiredProcessEnv('IMAGES_TAG')

const apiImage = new DockerImage({
	name: 'kevinand11/k8s-demo-app',
	tag,
	build: {
		context: path.resolve(__dirname, '../app'),
		platforms: [DockerPlatform.LINUX_AMD64]
	},
	async preBuild () {
		// TODO: build app
	}
})

export const images = {
	api: apiImage,
}