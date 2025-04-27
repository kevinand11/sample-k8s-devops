import { ApiObject, Include } from 'cdk8s'
import { Resource } from 'cdk8s-plus-32'
import { Construct } from 'constructs'
import { K8sHelm, K8sHelmProps } from './k8sHelm'
import { K8sChart } from './k8sChart'

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

export interface TraefikHelmProps extends Omit<K8sHelmProps, 'chart' | 'version'> {
  installCRDs?: boolean
}


export class TraefikHelm extends K8sHelm {
  private static registeredCRDs = false

  constructor (scope: K8sChart, id: string, { installCRDs, ...rest }: TraefikHelmProps) {
    super(scope, id, {
      ...rest,
      chart: 'oci://ghcr.io/traefik/helm/traefik',
      version: '35.1.0',
    })

    if (installCRDs && !TraefikHelm.registeredCRDs) {
      TraefikHelm.registeredCRDs = true
      new Include(this, `${id}-crds`, {
        url: 'https://raw.githubusercontent.com/traefik/traefik/v3.3/docs/content/reference/dynamic-configuration/kubernetes-crd-definition-v1.yml',
      })
    }
  }
}