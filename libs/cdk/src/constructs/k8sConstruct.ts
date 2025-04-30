import { Construct } from 'constructs'

type HookEvent = 'build' | 'deploy' | 'diff' | 'delete'
export type K8sConstructHook = `pre:${HookEvent}` | `post:${HookEvent}`
export type K8sConstructHookCallback = () => void | Promise<void>

interface AddHooksInterface {
	addHook (hook: K8sConstructHook, cb: () => void | Promise<void>): void;
	runHook (hook: K8sConstructHook): Promise<void>
}

export function AddK8sHook<T extends { new(...args: any[]) }> (constructor: T) {
	const hooks: Partial<Record<K8sConstructHook, K8sConstructHookCallback[]>> = {}
	return class extends constructor implements AddHooksInterface {
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

export class K8sConstruct extends AddK8sHook(Construct) {}