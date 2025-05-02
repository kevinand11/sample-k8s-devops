import { K8sApp, K8sDomain } from '@devops/k8s-cdk/k8s'

import { EnvironmentChart } from './charts/EnvironmentChart'
import { InfraChart } from './charts/InfraChart'
import { devopsConfig } from './envs'
import { deleteCloudflareRecord, getLoadBalancerIP, getRequiredProcessEnv, upsertCloudflareRecord } from './utils'

const env = getRequiredProcessEnv('ENVIRONMENT')

const cloudflareZoneId = devopsConfig.get('CLOUDFLARE_ZONE_ID')
const cloudflareApiToken = devopsConfig.get('CLOUDFLARE_API_TOKEN')
const domainName = devopsConfig.get('DOMAIN_NAME')
const domainCertEmail = devopsConfig.get('DOMAIN_CERT_EMAIL')
const twingateConnect = devopsConfig.get('TWINGATE_CONNECT', JSON.parse)

const baseDomain = K8sDomain.of({ name: domainName, wildcard: true })
const domain = env === 'prod' ? baseDomain : baseDomain.scope(env)

const infraChart = new InfraChart({
  namespace: 'stranerd-infra',
  certEmail: domainCertEmail,
  cloudflareApiToken,
  twingateAccess: devopsConfig.get(`TWINGATE_ACCESS_INFRA`, JSON.parse),
  twingateConnect,
})

const envChart = new EnvironmentChart({
  namespace: `stranerd-env-${env}`,
  env,
  domain,
  issuer: infraChart.issuer ? { name: infraChart.issuer.name, kind: infraChart.issuer.kind } : undefined,
  twingateAccess: devopsConfig.get(`TWINGATE_ACCESS_${env.toUpperCase()}`, JSON.parse),
})

const common = {
  zoneId: cloudflareZoneId,
  apiToken: cloudflareApiToken,
  type: 'A' as const,
}

envChart.addHook('post:deploy', async () => {
  const ip = getLoadBalancerIP(envChart.namespace)
  if (!ip) return

  await upsertCloudflareRecord({ ...common, recordName: domain.base, ip })
  await upsertCloudflareRecord({ ...common, recordName: domain.common, ip })
})

envChart.addHook('post:delete', async () => {
  await deleteCloudflareRecord({ ...common, recordName: domain.base })
  await deleteCloudflareRecord({ ...common, recordName: domain.common })
})


new K8sApp([infraChart, envChart]).process()
