import { K8sApp } from '@devops/k8s-cdk'
import { DevopsChart } from './charts/DevopsChart'
import { InfraChart } from './charts/InfraChart'

const infraChart = new InfraChart({
  namespace: 'infra',
  certEmail: process.env.DOMAIN_CERT_EMAIL!,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN!,
  domain: {
    name: process.env.DOMAIN_NAME!,
    wildcard: true,
  }
})

const devopsChart = new DevopsChart({
  namespace: 'dev',
  infra: infraChart,
})


new K8sApp([infraChart, devopsChart]).process()
