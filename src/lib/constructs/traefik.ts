import { ApiObject } from 'cdk8s'
import { Resource } from 'cdk8s-plus-32'
import { Construct } from 'constructs'

export interface TraefikAnnotationsProp {
  ingress: ApiObject | Resource
  annotations: Record<string, string | string[]>
}

export class TraefikAnnotations extends Construct {
  constructor(scope: Construct, id: string, options: TraefikAnnotationsProp) {
    super(scope, id);

    Object.entries(options.annotations).forEach(([key, val]) => {
      options.ingress.metadata.addAnnotation(`traefik.ingress.kubernetes.io/${key}`, Array.isArray(val) ? val.join(',') : val)
    })
  }
}

export interface TraefikMiddlewareProp {
  stripPrefix?: {
	  prefixes: string[]
  }
}

export class TraefikMiddleware extends ApiObject {
  constructor(scope: Construct, id: string, options: TraefikMiddlewareProp) {
    super(scope, id, {
      apiVersion: 'traefik.containo.us/v1alpha1',
      kind: 'Middleware',
      spec: {
        stripPrefix: options.stripPrefix,
      },
    });
  }

  get middlewareName () {
    return `${this.metadata.namespace}-${this.name}@kubernetescrd`
  }
}