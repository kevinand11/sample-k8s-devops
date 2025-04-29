import { Construct } from 'constructs'

type HookEvent = 'build' | 'deploy' | 'diff' | 'delete'
export type K8sConstructHook = `pre:${HookEvent}` | `post:${HookEvent}`
export type K8sConstructHookCallback = () => void | Promise<void>

interface AddHooksInterface {
  readonly hooks: Partial<Record<K8sConstructHook, K8sConstructHookCallback[]>>;
  addHook(hook: K8sConstructHook, cb: () => void | Promise<void>): void;
}

export function AddK8sHook<T extends { new(...args: any[]) }> (constructor: T) {
	const hooks: Partial<Record<K8sConstructHook, K8sConstructHookCallback[]>> = {}
	return class extends constructor implements AddHooksInterface {
		get hooks () {
			return hooks
		}

		addHook (hook: K8sConstructHook, cb: () => void | Promise<void>) {
			hooks[hook] ??= []
			hooks[hook].push(cb)
		}
	}
}

export class K8sConstruct extends AddK8sHook(Construct) {}