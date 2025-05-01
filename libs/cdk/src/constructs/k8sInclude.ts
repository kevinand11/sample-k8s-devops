import { randomUUID } from 'node:crypto'

import { Include, IncludeProps } from 'cdk8s'

import { K8sChart } from './k8sChart'
import { K8sConstruct } from './k8sConstruct'

interface K8sIncludeProps extends IncludeProps {}

export class K8sInclude extends K8sConstruct {
	private include?: Include

	constructor (private readonly scope: K8sChart, id: string, private readonly props: K8sIncludeProps) {
		super(scope, id)

		this.addHook('pre:build', () => {
			this.apiObjects
		})
	}

	get apiObjects () {
		if (!this.include) this.include = new Include(this.scope, `${this.id}-include-${randomUUID()}`, this.props)
		return this.include.apiObjects
	}
}