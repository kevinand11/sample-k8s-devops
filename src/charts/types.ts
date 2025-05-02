import { K8sChart, K8sDomain } from '@devops/k8s-cdk/k8s'
import { TwingateResource, TwingateResourceAccess } from '@devops/k8s-cdk/twingate'

export type TwingateAccess = {
	teamId: string
	policyId: string
}

export type TwingateConnect = {
	apiKey: string
	account: string
	remoteNetworkName: string
}

export type KafkaValues = {
  host: string
  auth: {
    securityProtocol: string
    saslMechanism: string
    saslJaasConfig: string
  }
}

export function createInternalRoute (chart: K8sChart, { name, service, access }: { name: string, service: string, access: TwingateAccess }) {
  const namespace = chart.namespace
  const internalDomain = K8sDomain.of({ name: 'local', wildcard: true }).scope(namespace)

  const resource = new TwingateResource(chart, `${name}-twingate-resourcer`, {
    spec: {
      name: chart.resolve(`${name}-${namespace}-twingate-resourcer`),
      address: chart.resolveDns(service),
      alias: internalDomain.scope(name).base
    }
  })

  new TwingateResourceAccess(chart, `${name}-twingate-resource-access`, {
    spec: {
      resourceRef: { name: resource.name, namespace },
      principalId: access.teamId,
      securityPolicyId: access.policyId,
    }
  })
}