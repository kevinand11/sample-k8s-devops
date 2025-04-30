import { K8sApp, K8sDomain } from '@devops/k8s-cdk/k8s'

import { DevopsChart } from './charts/DevopsChart'
import { InfraChart } from './charts/InfraChart'
import { devopsConfig } from './envs'
import { deleteCloudflareRecord, getLoadBalancerIP, getRequiredProcessEnv, upsertCloudflareRecord } from './utils'

const env = getRequiredProcessEnv('ENVIRONMENT')

const cloudflareZoneId = devopsConfig.get('CLOUDFLARE_ZONE_ID')
const cloudflareApiToken = devopsConfig.get('CLOUDFLARE_API_TOKEN')
const domainName = devopsConfig.get('DOMAIN_NAME')
const domainCertEmail = devopsConfig.get('DOMAIN_CERT_EMAIL')

const baseDomain = K8sDomain.of({ name: domainName, wildcard: true })
const domain = env === 'prod' ? baseDomain : baseDomain.scope(env)

const infraChart = new InfraChart({
  namespace: 'infra-ns',
  certEmail: domainCertEmail,
  cloudflareApiToken,
})

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
