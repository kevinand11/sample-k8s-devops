import { K8sCertManagerHelm, K8sChart, K8sChartProps, Ks8DomainProps, KsDomain } from '@devops/k8s-cdk'
import { Certificate, Issuer } from '@devops/k8s-cdk/cert-manager'
import { Secret } from '@devops/k8s-cdk/plus'

interface InfraChartProps extends K8sChartProps {
  certEmail: string
  cloudflareApiToken: string
  domain: Ks8DomainProps
}

export class InfraChart extends K8sChart {
  readonly domain: KsDomain
  readonly certificate: {
    name: string
    namespace: string
  }

  constructor(private readonly props: InfraChartProps) {
    super('infra', props);
    const { certSecretName } = this.createCertificate()
    this.domain = new KsDomain(props.domain)
    this.certificate = {
      name: certSecretName,
      namespace: this.namespace
    }
  }

  createCertificate () {
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

    const cloudflareApiTokenSecret = new Secret(this, 'cert-manager-issuer-cloudflare-api-token-secret', {
      stringData: {
        apiToken: cloudflareApiToken,
      }
    })

    const issuer = new Issuer(this, 'cert-manager-cluster-issuer', {
      spec: {
        acme: {
          email: certEmail,
          server: 'https://acme-staging-v02.api.letsencrypt.org/directory', // TODO remove staging after testing
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

    const certSecretName = this.resolve(`cert-manager-issuer-certificate-secret`)

    new Certificate(this, 'certificate', {
      spec: {
        secretName: certSecretName,
        issuerRef: {
          name: issuer.name,
          kind: issuer.kind,
        },
        commonName: this.domain.common,
        dnsNames: [this.domain.base, this.domain.common]
      }
    })

    return { certSecretName }
  }
}
