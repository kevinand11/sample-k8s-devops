import { $ } from 'zx'

export async function exec (command: string, injectInput?: string, allowNonZeroCodes?: boolean) {
	return new Promise<void>((res, rej) => {
		let stderr= ''
		const process = $.spawn(command, { stdio: ['pipe', 'inherit', null], shell: true });
		if (injectInput) {
			process.stdin?.write(injectInput)
			process.stdin?.end()
		}

		process.stderr.on('data', (data) => {
      		stderr += data.toString();
    	});

		process.on('close', (code) => {
			if (code === 0 || allowNonZeroCodes) return res()
			return rej(new Error(stderr))
		})

		process.on('error', (e) => rej(e))
	})
}