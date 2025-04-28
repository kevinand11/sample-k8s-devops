import { K8sApp } from '@devops/k8s-cdk'
import { DevopsChart } from './charts/DevopsChart'
import { InfraChart } from './charts/InfraChart'

const infraChart = new InfraChart({
  namespace: 'infra',
  domain: {
    name: process.env.DOMAIN_NAME!,
    certEmail: process.env.DOMAIN_CERT_EMAIL!,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN!,
    wildcard: true,
  }
})

const devopsChart = new DevopsChart({
  namespace: 'dev',
  certSecretName: infraChart.certSecretName
})


new K8sApp([infraChart, devopsChart]).process()
