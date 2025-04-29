import { Certificate, Issuer } from '@devops/k8s-cdk/cert-manager'
import { K8sCertManagerHelm, K8sChart, K8sChartProps, K8sDomain, K8sDomainProps } from '@devops/k8s-cdk/k8s'
import { Secret } from '@devops/k8s-cdk/plus'

interface InfraChartProps extends K8sChartProps {
  certEmail: string
  cloudflareApiToken: string
  domain: K8sDomainProps
}

export class InfraChart extends K8sChart {
  readonly domain: K8sDomain
  readonly certificateName?: string

  constructor(private readonly props: InfraChartProps) {
    super('infra', props)
    this.domain = new K8sDomain(props.domain)
    this.certificateName = this.resolve(`cert-manager-certificate-secret`)
    this.createCertificate(this.certificateName)
  }

  createCertificate (certSecretName: string) {
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

    const issuer = new Issuer(this, 'cert-manager-issuer', {
      spec: {
        acme: {
          email: certEmail,
          server: 'https://acme-v02.api.letsencrypt.org/directory',
          privateKeySecretRef: {
            name: this.resolve('cert-manager-issuer-private-key-secret'),
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

    new Certificate(this, 'cert-manager-certificate', {
      spec: {
        secretName: certSecretName,
        issuerRef: {
          name: issuer.name,
          kind: issuer.kind,
        },
        commonName: this.domain.common,
        dnsNames: Object.keys({ [this.domain.base]: true, [this.domain.common]: true })
      }
    })

    return { certSecretName }
  }
}
