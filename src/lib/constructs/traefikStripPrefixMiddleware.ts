import { Construct } from 'constructs'
import { cdk8s } from '..'

export interface TraefikStripPrefixMiddlewareProp {
	prefixes: string[]
}

export class TraefikStripPrefixMiddleware extends cdk8s.ApiObject {
  constructor(scope: Construct, id: string, options: TraefikStripPrefixMiddlewareProp) {
    super(scope, id, {
      apiVersion: 'traefik.containo.us/v1alpha1',
      kind: 'Middleware',
      spec: {
        stripPrefix: {
          prefixes: options.prefixes.map((prefix) => `/${prefix.replaceAll('/', '-')}`),
        },
      },
    });
  }

  get middlewareName () {
    return `${this.metadata.namespace}-${this.name}@kubernetescrd`
  }
}