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

  constructor(private readonly props: InfraChartProps) {
    super('infra', props);

    this.certSecretName = this.getFullName(`cert-manager-certifcate-secret`)
    this.createCertificate()
  }

  createCertificate () {
    new K8sCertManagerHelm(this, 'cert-manager', {
      values: {
        installCRDs: true,
        controller: {
          extraArgs: [
            '--dns01-recursive-nameservers-only',
            '--dns01-recursive-nameservers=1.1.1.1:53,9.9.9.9:53',
          ],
          dnsPolicy: 'None',
          dnsConfig: {
            nameservers: ['1.1.1.1', '9.9.9.9']
          }
        },
        rbac: { create: false }
      },
    })

    const { name: domainName, wildcard = false, certEmail, cloudflareApiToken } = this.props.domain

    const privateKeySecret = new Secret(this, 'issuer-private-key-secret')
    const cloudflareApiTokenSecret = new Secret(this, 'issuer-cloudflare-api-token-secret', {
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
            name: privateKeySecret.name,
            key: 'tls.key'
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
              selector: {
                dnsZones: [domainName]
              }
            }
          ]
        }
      }
    })

    new Certificate(this, 'cert-manager-certificate', {
      spec: {
        secretName: this.certSecretName,
        issuerRef: {
          name: issuer.name,
          kind: issuer.kind,
        },
        commonName: domainName,
        dnsNames: [domainName, wildcard ? `*.${domainName}` : ''].filter(Boolean)
      }
    })
  }
}
