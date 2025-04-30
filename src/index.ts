import { execSync } from 'node:child_process'

import { K8sApp, K8sDomain } from '@devops/k8s-cdk/k8s'

import { DevopsChart } from './charts/DevopsChart'
import { InfraChart } from './charts/InfraChart'
import { deleteCloudflareRecord, getRequiredProcessEnv, upsertCloudflareRecord } from './utils'

const env: string = getRequiredProcessEnv('ENVIRONMENT')
const cloudflareZoneId = getRequiredProcessEnv('CLOUDFLARE_ZONE_ID')
const cloudflareApiToken = getRequiredProcessEnv('CLOUDFLARE_API_TOKEN')
const domainName = getRequiredProcessEnv('DOMAIN_NAME')
const domainCertEmail = getRequiredProcessEnv('DOMAIN_CERT_EMAIL')

const infraChart = new InfraChart({
  namespace: 'infra-ns',
  certEmail: domainCertEmail,
  cloudflareApiToken,
})

const baseDomain = K8sDomain.of({ name: domainName, wildcard: true })
const domain = env === 'prod' ? baseDomain : baseDomain.scope(env)

const devopsChart = new DevopsChart({
  namespace: `${env}-ns`,
  domain,
  issuer: infraChart.issuer ? { name: infraChart.issuer.name, kind: infraChart.issuer.kind } : undefined,
})

const common = {
  zoneId: cloudflareZoneId,
  apiToken: cloudflareApiToken,
  type: 'A' as const,
}

devopsChart.addHook('post:deploy', async () => {
  const ip = getLoadBalancerIP(devopsChart.namespace)
  if (!ip) return

  await upsertCloudflareRecord({ ...common, recordName: devopsChart.domain.base, ip })
  await upsertCloudflareRecord({ ...common, recordName: devopsChart.domain.common, ip })
})

devopsChart.addHook('post:delete', async () => {
  await deleteCloudflareRecord({ ...common, recordName: devopsChart.domain.base })
  await deleteCloudflareRecord({ ...common, recordName: devopsChart.domain.common })
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