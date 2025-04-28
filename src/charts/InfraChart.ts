import { K8sCertManagerHelm, K8sChart, K8sChartProps } from '@devops/k8s-cdk'
import { Certificate, Issuer } from '@devops/k8s-cdk/cert-manager'
import { Secret } from '@devops/k8s-cdk/plus'

interface InfraChartProps extends K8sChartProps {
  domain: {
    name: string;
    wildcard?: boolean;
    certEmail: string;
    cloudflareApiToken: string
  }
}

export class InfraChart extends K8sChart {
  certSecretName: string
  certDomainName: string

  constructor(private readonly props: InfraChartProps) {
    super('infra', props);

    this.certSecretName = this.resolve(`cert-manager-issuer-certificate-secret`)
    this.certDomainName = props.domain.wildcard ? `*.${props.domain.name}` : props.domain.name
    this.createCertificate()
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

    const { name: domainName, wildcard = false, certEmail, cloudflareApiToken } = this.props.domain

    const cloudflareApiTokenSecret = new Secret(this, 'cert-manager-issuer-cloudflare-api-token-secret', {
      stringData: {
        apiToken: cloudflareApiToken,
      }
    })

    const issuer = new Issuer(this, 'cert-manager-issuer', {
      spec: {
        acme: {
          email: certEmail,
          server: 'https://acme-staging-v02.api.letsencrypt.org/directory', // https://acme-v02.api.letsencrypt.org/directory for prod
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

    new Certificate(this, 'cert-manager-issuer-certificate', {
      spec: {
        secretName: this.certSecretName,
        issuerRef: {
          name: issuer.name,
          kind: issuer.kind,
        },
        commonName: this.certDomainName,
        dnsNames: [domainName, wildcard ? `*.${domainName}` : ''].filter(Boolean)
      }
    })
  }
}
