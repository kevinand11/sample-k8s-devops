interface K8sDomainProps {
	name: string
	wildcard?: boolean
	parent?: K8sDomain
}

export class K8sDomain {
	private constructor (private readonly props: K8sDomainProps) { }

	get common () {
		return (this.props.wildcard ? this.scope('*') : this).base
	}

	get base () {
		return this.props.name
	}

	static of (props: K8sDomainProps) {
		return new K8sDomain(props)
	}

	scope (scope: string) {
		return new K8sDomain({
			...this.props,
			name: [scope, this.props.name].join(this.props.wildcard ? '.' : '-')
		})
	}
}
