export class Platform {
	readonly platform: string;
	private constructor (platform: string) {
		this.platform = platform
	}

	static LINUX_AMD64 () {
		return new Platform('linux/amd64')
	}

	static LINUX_ARM64 () {
		return new Platform('linux/arm64')
	}

	static custom (platform: string) {
		return new Platform(platform)
	}
}