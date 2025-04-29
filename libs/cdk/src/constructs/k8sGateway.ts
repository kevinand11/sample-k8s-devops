import { ApiObjectMetadata, Include } from 'cdk8s'
import { Gateway, GatewayClass, GatewaySpecListeners, HttpRoute, HttpRouteSpecRulesBackendRefs, HttpRouteSpecRulesMatchesPathType } from '../../imports/gateway.networking.k8s.io'
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
	host?: string
	path?: string
	pathType?: HttpRouteSpecRulesMatchesPathType
}

export class K8sGateway extends Gateway {
	constructor (private readonly scope: K8sChart, id: string, props: K8sGatewayProps) {
		const gatewayClass = props.gatewayClass instanceof GatewayClass ? props.gatewayClass : new GatewayClass(scope, `${id}-class`, { spec: props.gatewayClass })
		super(scope, id, {
			spec: {
				gatewayClassName: gatewayClass.name,
				listeners: props.listeners
			}
		})
	}

	addRoute (id: string, backend: HttpRouteSpecRulesBackendRefs, route?: K8sGatewayRouteProps) {
		return new HttpRoute(this.scope, id, {
			spec: {
				parentRefs: [{ name: this.name }],
				...(route?.host ? { hostnames: [route.host] } : {}),
				rules: [
					{
						...(route?.path ? { matches: [{ path: { type: route.pathType ?? HttpRouteSpecRulesMatchesPathType.PATH_PREFIX, value: route.path } }] } : {}),
						backendRefs: [backend],
					}
				]
			}
     	})
	}
}