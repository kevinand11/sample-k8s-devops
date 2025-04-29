export interface Ks8DomainProps {
	name: string
	wildcard?: boolean
}

export class KsDomain {
	constructor (private readonly props: Ks8DomainProps) { }

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

	scope (scope: string) {
		return new KsDomain({
			...this.props,
			name: this.#calc(scope)
		})
	}
}
