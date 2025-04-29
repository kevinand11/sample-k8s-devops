import { execSync } from 'node:child_process'

import { K8sApp } from '@devops/k8s-cdk/k8s'

import { DevopsChart } from './charts/DevopsChart'
import { InfraChart } from './charts/InfraChart'
import { getRequiredProcessEnv, upsertCloudflareRecord } from './utils'

const cloudflareZoneId = getRequiredProcessEnv('CLOUDFLARE_ZONE_ID')
const cloudflareApiToken = getRequiredProcessEnv('CLOUDFLARE_API_TOKEN')
const domainName = getRequiredProcessEnv('DOMAIN_NAME')
const domainCertEmail = getRequiredProcessEnv('DOMAIN_CERT_EMAIL')

const infraChart = new InfraChart({
  namespace: 'infra',
  certEmail: domainCertEmail,
  cloudflareApiToken,
  domain: { name: domainName, wildcard: true }
})

const devopsChart = new DevopsChart({
  namespace: 'dev',
  domain: infraChart.domain.scope('dev'),
  certificate: infraChart.certificateName ? { name: infraChart.certificateName, namespace: infraChart.namespace } : undefined
})

devopsChart.addHook('post:deploy', async () => {
  const ip = getLoadBalancerIP(devopsChart.namespace)
  if (!ip) return

  const common = {
    zoneId: cloudflareZoneId,
    apiToken: cloudflareApiToken,
    type: 'A' as const,
    ip,
  }

  await upsertCloudflareRecord({ ...common, recordName: devopsChart.domain.base })
  await upsertCloudflareRecord({ ...common, recordName: devopsChart.domain.common })
})


new K8sApp([infraChart, devopsChart]).process()

function getLoadBalancerIP(ns: string) {
  const output = execSync(`kubectl get services -n ${ns} -o json`).toString()
  const json = JSON.parse(output)
  for (const svc of json.items) {
    const type = svc.spec.type
    const ip = svc.status?.loadBalancer?.ingress?.[0]?.ip
    if (type === "LoadBalancer" && ip) return ip
  }
}