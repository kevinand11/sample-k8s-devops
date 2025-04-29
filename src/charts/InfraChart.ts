import { ClusterIssuer } from '@devops/k8s-cdk/cert-manager'
import { K8sCertManagerHelm, K8sChart, K8sChartProps } from '@devops/k8s-cdk/k8s'
import { Secret } from '@devops/k8s-cdk/plus'

interface InfraChartProps extends K8sChartProps {
  certEmail: string
  cloudflareApiToken: string
}

export class InfraChart extends K8sChart {
  readonly issuer?: ClusterIssuer

  constructor(private readonly props: InfraChartProps) {
    super('infra', props)
    const { issuer } = this.createIssuer()
    this.issuer = issuer
  }

  createIssuer () {
    new K8sCertManagerHelm(this, 'cert-manager', {
      values: {
        namespace: this.namespace,
        crds: { enabled: true },
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
}
