export interface Ks8DomainProps {
	scope?: string
	domain: {
		name: string
		wildcard?: boolean
	}
}

export class KsDomain {
	constructor (private readonly props: Ks8DomainProps) { }

	get common () {
		return this.#calc(this.props.domain.wildcard ? '*' : undefined)
	}

	get base () {
		return this.#calc()
	}

	sub (sub: string) {
		return this.#calc(sub)
	}

	#calc (sub?: string) {
		const { scope, domain: { name, wildcard } } = this.props
		return [sub, scope, name].filter(Boolean).join(wildcard ? '.' : '-')
	}
}
