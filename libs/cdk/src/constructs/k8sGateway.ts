import { ApiObjectMetadata, Include } from 'cdk8s'
import { Gateway, GatewayClass, GatewaySpecListeners, HttpRoute, HttpRouteSpecRulesBackendRefs, HttpRouteSpecRulesFilters, HttpRouteSpecRulesFiltersRequestRedirect, HttpRouteSpecRulesFiltersType, HttpRouteSpecRulesMatches, HttpRouteSpecRulesMatchesPathType } from '../../imports/gateway.networking.k8s.io'
import { K8sChart } from './k8sChart'

export class K8sGatewayCRDs extends Include {
	constructor (scope: K8sChart, id: string) {
    	super(scope, id, { url: 'https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml' })
	}
}

export interface K8sGatewayProps {
	metadata?: ApiObjectMetadata
	gatewayClass: { controllerName: string } | GatewayClass
	listeners: GatewaySpecListeners[]
}

export interface K8sGatewayRouteProps {
	listener: string
	host?: string
	path?: string
	pathType?: HttpRouteSpecRulesMatchesPathType
	redirect?: HttpRouteSpecRulesFiltersRequestRedirect
}

export class K8sGateway extends Gateway {
	constructor (private readonly scope: K8sChart, id: string, private readonly gatewayProps: K8sGatewayProps) {
		const gatewayClass = gatewayProps.gatewayClass instanceof GatewayClass ? gatewayProps.gatewayClass : new GatewayClass(scope, `${id}-class`, { spec: gatewayProps.gatewayClass })
		super(scope, id, {
			spec: {
				gatewayClassName: gatewayClass.name,
				listeners: gatewayProps.listeners
			}
		})
	}

	addRoute (id: string, backend: HttpRouteSpecRulesBackendRefs, route: K8sGatewayRouteProps) {
		if (route?.listener) {
			const listener = this.gatewayProps.listeners.find((l) => l.name === route.listener)
			if (!listener) throw new Error(`${route.listener} is not a registered listener for ${this.name}`)
		}

		const matches: HttpRouteSpecRulesMatches[] = []
		const filters: HttpRouteSpecRulesFilters[] = []

		if (route.path) matches.push({ path: { type: route.pathType ?? HttpRouteSpecRulesMatchesPathType.PATH_PREFIX, value: route.path } })
		if (route.redirect) filters.push({ type: HttpRouteSpecRulesFiltersType.REQUEST_REDIRECT, requestRedirect: route.redirect })

		return new HttpRoute(this.scope, id, {
			spec: {
				parentRefs: [{ name: this.name, sectionName: route?.listener }],
				...(route?.host ? { hostnames: [route.host] } : {}),
				rules: [
					{
						...(matches.length ? { matches } : undefined),
						...(filters.length ? { filters } : undefined),
						backendRefs: [backend],
					}
				]
			}
     	})
	}
}