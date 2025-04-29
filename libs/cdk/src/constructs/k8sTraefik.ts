import { ApiObject } from 'cdk8s'
import { Resource } from 'cdk8s-plus-32'
import { Construct } from 'constructs'
import { Middleware, MiddlewareSpec } from '../../imports/traefik.io'
import { K8sChart } from './k8sChart'
import { K8sHelm, K8sHelmProps } from './k8sHelm'

export interface K8sTraefikAnnotationsProp {
  ingress: ApiObject | Resource
  annotations: Record<string, string | string[]>
}

interface Annotations {
  entryPoints?: string[]
  middlewares?: string[]
}

export class K8sTraefikAnnotations {
  private constructor (private readonly annotations: Annotations = {}) { }

  static build () {
    return new K8sTraefikAnnotations({})
  }

  private add<T extends keyof Annotations> (key: T, value: any, isArray: Exclude<Annotations[T], undefined> extends Array<any> ? true : false) {
    const annotations = this.annotations
    if (isArray) {
      annotations[key] ??= []
      annotations[key].push(value)
    } else annotations[key] = value
    return new K8sTraefikAnnotations(annotations)
  }

  collect<T extends ApiObject | Resource> (parent: T) {
    const annotations = this.annotations
    if (annotations.entryPoints?.length) parent.metadata.addAnnotation('traefik.ingress.kubernetes.io/router.entrypoints', annotations.entryPoints.join(','))
    if (annotations.middlewares?.length) parent.metadata.addAnnotation('traefik.ingress.kubernetes.io/router.middlewares', annotations.middlewares.join(','))
    return parent
  }

  addEntryPoint (value: 'web' | 'websecure' | string) {
    return this.add('entryPoints', value, true)
  }

  addMiddleware (value: K8sTraefikMiddleware) {
    return this.add('middlewares', value.nameResolution, true)
  }
}

export interface K8sTraefikMiddlewareProp extends MiddlewareSpec {}

export class K8sTraefikMiddleware extends Middleware {
  constructor(scope: Construct, id: string, spec: K8sTraefikMiddlewareProp) {
    super(scope, id, {
      metadata: {},
      spec,
    });
  }

  get nameResolution () {
    return `${this.metadata.namespace}-${this.name}@kubernetescrd`
  }
}

export interface K8sTraefikHelmProps extends Omit<K8sHelmProps, 'chart' | 'version'> {
  installCRDs?: boolean
}


export class K8sTraefikHelm extends K8sHelm {
  constructor (scope: K8sChart, id: string, { installCRDs, ...rest }: K8sTraefikHelmProps) {
    super(scope, id, {
      ...rest,
      chart: 'traefik',
      repo: 'https://traefik.github.io/charts',
      version: '35.1.0',
    })
  }
}