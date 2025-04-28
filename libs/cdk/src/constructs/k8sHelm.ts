import { ApiObject, ApiObjectProps, Helm, HelmProps } from 'cdk8s'
import { Construct } from 'constructs'
import { K8sChart } from './k8sChart'

export interface K8sHelmProps extends Omit<HelmProps, 'releaseName'> {}

export class K8sHelm extends Helm {
	constructor (scope: K8sChart, id: string, readonly props: K8sHelmProps) {
		super(scope, id, {
			namespace: scope.namespace,
			releaseName: scope.node.id,
			...props,
		})
	}

	getTypedObject<Spec extends Partial<ApiObjectProps>, T extends ApiObject>(condition: (o: ApiObject) => boolean, constructor: new (scope: Construct, id: string, props: Spec) => T) {
		const objIdx = this.apiObjects.findIndex((o) => condition(o))
		if (objIdx === -1) return undefined
		const obj = this.apiObjects[objIdx]
		this.node.tryRemoveChild(obj.node.id)
		const newObj = new constructor(this, obj.node.id, obj.toJson())
		obj.node.setContext(obj.node.id, newObj)
		this.apiObjects[objIdx] = newObj
		return newObj
	}
}
