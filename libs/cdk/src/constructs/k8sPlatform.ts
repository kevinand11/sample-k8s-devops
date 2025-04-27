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