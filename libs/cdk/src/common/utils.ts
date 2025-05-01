import { execSync as execCommandSync } from 'node:child_process'
import { access, constants, mkdir } from 'node:fs/promises'

import { $ } from 'zx'

export function upsertNamespace (ns: string) {
	const yaml = `
apiVersion: v1
kind: Namespace
metadata:
  name: ${ns}
`
    execCommandSync(`kubectl apply -f -`, { input: yaml, stdio: ['pipe'] })
}

export function execSync (command: string) {
	const result = execCommandSync(command)
	return result.toString().trim()
}

export async function exec (command: string, injectInput?: string, allowNonZeroCodes?: boolean) {
	return new Promise<void>((res, rej) => {
		let stderr= ''
		const process = $.spawn(command, { stdio: ['pipe', 'inherit', null], shell: true })
		if (injectInput) {
			process.stdin?.write(injectInput)
			process.stdin?.end()
		}

		process.stderr.on('data', (data) => stderr += data.toString())

		process.on('close', (code) => {
			if (code === 0 || allowNonZeroCodes) return res()
			return rej(new Error(stderr))
		})

		process.on('error', (e) => rej(e))
	})
}

export async function createFolderIfNotExists(folderPath: string) {
  try {
    await access(folderPath, constants.F_OK)
  } catch {
    await mkdir(folderPath, { recursive: true })
  }
}

export async function runWithTrials<T extends (trial: number) => any> (fn: T, opts: { tries: number, delayMs: number }) :Promise<Awaited<ReturnType<T>>> {
	let error: Error | undefined
	for (const trial of new Array(opts.tries).fill(0).map((_, i) => i + 1)) {
		try {
			return await fn(trial)
		} catch (err) {
			error = err
			await new Promise<void>((res) => setTimeout(res, opts.delayMs))
		}
	}
	throw error ?? new Error('failed to execute trials')
}