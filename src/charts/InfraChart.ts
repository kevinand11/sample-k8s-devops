import { ApiObject } from '@devops/k8s-cdk'
import { ClusterIssuer } from '@devops/k8s-cdk/cert-manager'
import { K8sChart, K8sChartProps, K8sCRDs, K8sHelm, K8sInclude } from '@devops/k8s-cdk/k8s'
import { Secret } from '@devops/k8s-cdk/plus'
import { TwingateConnector, TwingateConnectorSpecImagePolicyProvider } from '@devops/k8s-cdk/twingate'

import { TwingateAccess, TwingateConnect } from './commons/types'

interface InfraChartProps extends K8sChartProps {
  certEmail: string
  cloudflareApiToken: string
  twingateAccess: TwingateAccess
  twingateConnect: TwingateConnect
  nrLicenseKey: string
}

export class InfraChart extends K8sChart {
  readonly issuer?: ClusterIssuer

  constructor(private readonly props: InfraChartProps) {
    super('infra', props)

    const crds = [
      K8sCRDs.certManager(),
      K8sCRDs.gateway(),
      K8sCRDs.traefik(),
      K8sCRDs.traefikHub(),
      K8sCRDs.twingateOperator()
    ].flat()

    crds.map((crd) => new K8sInclude(this, `crd-${crd}`, { url: crd }))

    const { issuer } = this.createIssuer()
    this.issuer = issuer

    this.createTwingateConnector()
    this.createAPM()
    this.createLocalTunneling()
  }

  createIssuer () {
    K8sHelm.certManager(this, 'cert-manager', {
      values: {
        namespace: this.namespace,
        crds: { enabled: false },
        global: {
          leaderElection: { namespace: this.namespace },
        },
        dns01RecursiveNameserversOnly: true,
        dns01RecursiveNameservers: '1.1.1.1:53,9.9.9.9:53',
        podDnsPolicy: 'None',
        podDnsConfig: {
          nameservers: ['1.1.1.1', '9.9.9.9']
        }
      },
    })

    const { certEmail, cloudflareApiToken } = this.props

    const cloudflareApiTokenSecret = new Secret(this, 'cert-manager-cloudflare-api-token-secret', {
      stringData: {
        apiToken: cloudflareApiToken,
      }
    })

    const issuer = new ClusterIssuer(this, 'cert-manager-cluster-issuer', {
      spec: {
        acme: {
          email: certEmail,
          server: 'https://acme-v02.api.letsencrypt.org/directory',
          privateKeySecretRef: {
            name: this.resolve('cert-manager-cluster-issuer-private-key-secret'),
          },
          solvers: [
            {
              dns01: {
                cloudflare: {
                  apiTokenSecretRef: {
                    name: cloudflareApiTokenSecret.name,
                    key: 'apiToken'
                  }
                }
              },
            }
          ]
        }
      }
    })

    return { issuer }
  }

  createTwingateConnector () {
    K8sHelm.twingateOperator(this, 'twingate-operator', {
      values: {
        twingateOperator: {
          apiKey: this.props.twingateConnect.apiKey,
          network: this.props.twingateConnect.account,
          remoteNetworkName: this.props.twingateConnect.remoteNetworkName,
        },
      },
    })

    new TwingateConnector(this, 'twingate-connector', {
      spec: {
        name: this.resolve('twingate-connector'),
        imagePolicy: { provider: TwingateConnectorSpecImagePolicyProvider.DOCKERHUB, schedule: '0 0 * * *' },
        hasStatusNotificationsEnabled: true,
      }
    })
  }

  createAPM () {
    new K8sHelm(this, 'new-relic', {
      chart: 'nri-bundle',
      repo: 'https://helm-charts.newrelic.com',
      version: '5.0.122',
      values: {
        global: {
          licenseKey: this.props.nrLicenseKey,
          cluster: 'stranerd-cluster',
          lowDataMode: true,
        },
        'kube-state-metrics': { enabled: true },
        'newrelic-logging': { enabled: true },
        'k8s-agents-operator': { enabled: true },
        'nri-metadata-injection:': {
          certManager: { enabled: true }
        }
      },
    })

    new ApiObject(this, 'nodejs-instrumentation', {
      apiVersion: 'newrelic.com/v1alpha2',
      kind: 'Instrumentation',
      spec: {
        agent: {
          language: 'nodejs',
          image: 'newrelic/newrelic-node-init:latest',
        },
        podLabelSelector: {
          matchExpressions: [
            {
              key: 'instrument.nr',
              operator: 'In',
              values: ['nodejs']
            }
          ],
        },
      },
    })
  }

  createLocalTunneling () {
    new K8sHelm(this, 'telepresence', {
      chart: 'oci://ghcr.io/telepresenceio/telepresence-oss',
      version: '2.22.4',
    })
  }
}
