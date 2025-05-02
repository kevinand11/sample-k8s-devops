import { Construct } from 'constructs'

type HookEvent = 'build' | 'deploy' | 'diff' | 'delete'
export type K8sConstructHook = `pre:${HookEvent}` | `post:${HookEvent}`
export type K8sConstructHookCallback = () => void | Promise<void>

interface K8sHooks {
	addHook (hook: K8sConstructHook, cb: () => void | Promise<void>): void;
	runHook (hook: K8sConstructHook): Promise<void>
}

const hooksSymbol = Symbol.for('k8s.hooks')

export function AddK8sHooks<T extends Construct> (constructor: { new (...args: any[]): T }) {
	const hooks: Partial<Record<K8sConstructHook, K8sConstructHookCallback[]>> = {}
	// @ts-expect-error invalid extends
	return class extends constructor implements K8sHooks {
		constructor (...args) {
			super(...args)
			Object.defineProperty(this, hooksSymbol, { value: true })
		}

		addHook (hook: K8sConstructHook, cb: () => void | Promise<void>) {
			hooks[hook] ??= []
			hooks[hook].push(cb)
		}

		async runHook (hook: K8sConstructHook) {
			const cbs = hooks[hook] ?? []
			for (const cb of cbs) await cb()
		}
	}
}
