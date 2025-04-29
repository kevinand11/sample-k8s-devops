import { Construct } from 'constructs'

type HookEvent = 'build' | 'deploy' | 'diff' | 'delete'
export type K8sConstructHook = `pre:${HookEvent}` | `post:${HookEvent}`
export type K8sConstructHookCallback = () => void | Promise<void>

export abstract class K8sConstruct extends Construct {
	readonly hooks: Partial<Record<K8sConstructHook, K8sConstructHookCallback[]>> = {}

	addHook (hook: K8sConstructHook, cb: () => void | Promise<void>) {
		this.hooks[hook] ??= []
		this.hooks[hook].push(cb)
	}
}