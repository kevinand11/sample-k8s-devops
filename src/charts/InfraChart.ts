import { ClusterIssuer } from '@devops/k8s-cdk/cert-manager'
import { K8sChart, K8sChartProps, K8sCRDs, K8sHelm, K8sInclude } from '@devops/k8s-cdk/k8s'
import { Secret } from '@devops/k8s-cdk/plus'

interface InfraChartProps extends K8sChartProps {
  certEmail: string
  cloudflareApiToken: string
}

export class InfraChart extends K8sChart {
  readonly issuer?: ClusterIssuer

  constructor(private readonly props: InfraChartProps) {
    super('infra', props)

    const crds = [
      K8sCRDs.certManager(),
      K8sCRDs.gateway(),
      K8sCRDs.prometheus(),
      K8sCRDs.traefik(),
      K8sCRDs.traefikHub(),
      K8sCRDs.twingateOperator()
    ].flat()

    crds.map((crd) => new K8sInclude(this, `crd-${crd}`, { url: crd }))

    const { issuer } = this.createIssuer()
    this.issuer = issuer

    this.createMonitoring()
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

  createMonitoring () {
    const loki = new K8sHelm(this, 'loki', {
      chart: 'loki',
      repo: 'https://grafana.github.io/helm-charts',
      version: '6.29.0',
      values: {
        deploymentMode: 'SingleBinary',
        singleBinary: { replicas: 1 },
        write: { replicas: 0 },
        read: { replicas: 0 },
        backend: { replicas: 0 },
        loki: {
          useTestSchema: true,
          storage: { type: 'filesystem' },
        },
        test: { enabled: false },
      }
    })

    const lokiService = loki.apiObjects.find((o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'gateway')!

    const prometheus = new K8sHelm(this, 'prometheus', {
      chart: 'kube-prometheus-stack',
      repo: 'https://prometheus-community.github.io/helm-charts',
      version: '71.2.0',
      values: {
        grafana: {
          additionalDataSources: [{ name: 'Loki', type: 'loki', access: 'proxy', url: `http://${this.resolveDns(lokiService.name)}` }]
        }
      }
    })

    const _grafanaService = prometheus.apiObjects.find((o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/name') === 'grafana')
  }
}
