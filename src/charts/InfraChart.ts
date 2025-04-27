import { Certificate, Issuer } from '../../imports/cert-manager.io'
import { cdk8s, K8sApp, K8sHelm, kplus } from '../lib'

type InfraChartProps = {
  domain: {
    name: string;
    wildcard?: boolean;
    certEmail: string;
  }
}

export class InfraChart extends cdk8s.Chart {
  certSecretName?: string

  constructor(private readonly scope: K8sApp, private readonly props: InfraChartProps) {
    super(scope, 'infra', {
      disableResourceNameHashes: true,
      namespace: scope.namespace,
      labels: { env: scope.env },
    });

    const { certSecretName } = this.createCertificate()
    this.certSecretName = certSecretName
  }

  createCertificate () {
    new K8sHelm(this, 'cert-manager', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/cert-manager',
      version: '1.4.14',
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

    const certificateSecret = new kplus.Secret(this, 'certificate-secret')

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
