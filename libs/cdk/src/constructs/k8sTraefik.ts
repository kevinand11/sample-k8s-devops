import { ApiObject, Include } from 'cdk8s'
import { Resource } from 'cdk8s-plus-32'
import { Construct } from 'constructs'
import { IngressRoute } from '../../imports/traefik.io'
import { K8sChart } from './k8sChart'
import { K8sHelm, K8sHelmProps } from './k8sHelm'

export interface K8sTraefikAnnotationsProp {
  ingress: ApiObject | Resource
  annotations: Record<string, string | string[]>
}

export class K8sTraefikAnnotations extends Construct {
  constructor(scope: Construct, id: string, options: K8sTraefikAnnotationsProp) {
    super(scope, id);

    Object.entries(options.annotations).forEach(([key, val]) => {
      options.ingress.metadata.addAnnotation(`traefik.ingress.kubernetes.io/${key}`, Array.isArray(val) ? val.join(',') : val)
    })
  }
}

export interface K8sTraefikMiddlewareProp {
  stripPrefix?: {
	  prefixes: string[]
  }
}

export class K8sTraefikMiddleware extends ApiObject {
  constructor(scope: Construct, id: string, options: K8sTraefikMiddlewareProp) {
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

export interface K8sTraefikHelmProps extends Omit<K8sHelmProps, 'chart' | 'version'> {
  installCRDs?: boolean
}


export class K8sTraefikHelm extends K8sHelm {
  private static registeredCRDs = false
  readonly ingressRoute?: IngressRoute

  constructor (scope: K8sChart, id: string, { installCRDs, ...rest }: K8sTraefikHelmProps) {
    super(scope, id, {
      ...rest,
      chart: 'oci://ghcr.io/traefik/helm/traefik',
      version: '35.1.0',
    })

    this.ingressRoute = this.getTypedObject(
      (o) => o.kind === 'IngressRoute',
      IngressRoute
    )

    if (installCRDs && !K8sTraefikHelm.registeredCRDs) {
      K8sTraefikHelm.registeredCRDs = true
      new Include(this, `${id}-crds`, {
        url: 'https://raw.githubusercontent.com/traefik/traefik/v3.3/docs/content/reference/dynamic-configuration/kubernetes-crd-definition-v1.yml',
      })
    }
  }
}