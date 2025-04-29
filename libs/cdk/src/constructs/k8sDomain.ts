export interface K8sDomainProps {
	name: string
	wildcard?: boolean
}

export class K8sDomain {
	constructor (private readonly props: K8sDomainProps) { }

	get common () {
		return this.#calc(this.props.wildcard ? '*' : undefined)
	}

	get base () {
		return this.#calc()
	}

	sub (sub: string) {
		return this.#calc(sub)
	}

	#calc (sub?: string) {
		const { name, wildcard } = this.props
		return [sub, name].filter(Boolean).join(wildcard ? '.' : '-')
	}

	scope (scope?: string): K8sDomainProps {
		return {
			...this.props,
			name: this.#calc(scope)
		}
	}
}
