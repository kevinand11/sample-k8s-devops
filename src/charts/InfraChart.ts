import { K8sCertManagerHelm, K8sChart, K8sChartProps } from '@devops/k8s-cdk'
import { Certificate, Issuer } from '@devops/k8s-cdk/cert-manager'
import { Secret } from '@devops/k8s-cdk/plus'

interface InfraChartProps extends K8sChartProps {
  domain: {
    name: string;
    wildcard?: boolean;
    certEmail: string;
  }
}

export class InfraChart extends K8sChart {
  certSecretName?: string

  constructor(private readonly props: InfraChartProps) {
    super('infra', props);

    const { certSecretName } = this.createCertificate()
    this.certSecretName = certSecretName
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

    const certificateSecret = new Secret(this, 'certificate-secret')

    const { name: domainName, wildcard = false, certEmail } = this.props.domain
    const issuer = new Issuer(this, 'cert-manager-issuer', {
      spec: {
        acme: {
          email: certEmail,
          server: 'https://acme-staging-v02.api.letsencrypt.org/directory', // https://acme-v02.api.letsencrypt.org/directory for prod
          privateKeySecretRef: {
            name: certificateSecret.name,
            key: 'tls.key'
          },
          solvers: [
            {
              // TODO: complete impl
              dns01: {
                webhook: {
                  solverName: 'godaddy',
                  groupName: `acme.${domainName}`,
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

    const certSecretName = `${this.node.id}-cert-manager-certifcate-secret`
    new Certificate(this, 'cert-manager-certificate', {
      spec: {
        secretName: certSecretName,
        issuerRef: {
          name: issuer.name,
          kind: issuer.kind,
        },
        commonName: wildcard ? `*.${domainName}` : domainName,
        dnsNames: [domainName, wildcard ? `*.${domainName}` : ''].filter(Boolean)
      }
    })

    return { certSecretName }
  }
}
