import { K8sApp, K8sDomain } from '@devops/k8s-cdk/k8s'

import { EnvironmentChart } from './charts/EnvironmentChart'
import { InfraChart } from './charts/InfraChart'
import { devopsConfig } from './envs'
import { deleteCloudflareRecord, getLoadBalancerIP, getRequiredProcessEnv, upsertCloudflareRecord } from './utils'

const env = getRequiredProcessEnv('ENVIRONMENT')

const cloudflareApiToken = devopsConfig.get('CLOUDFLARE_API_TOKEN')
const domainName = devopsConfig.get('DOMAIN_NAME')

const baseDomain = K8sDomain.of({ name: domainName, wildcard: true })
const domain = env === 'prod' ? baseDomain : baseDomain.scope(env)

const infraChart = new InfraChart({
  namespace: 'stranerd-infra',
  certEmail: devopsConfig.get('DOMAIN_CERT_EMAIL'),
  cloudflareApiToken,
  twingateAccess: devopsConfig.get(`TWINGATE_ACCESS_INFRA`, JSON.parse),
  twingateConnect: devopsConfig.get('TWINGATE_CONNECT', JSON.parse),
  nrLicenseKey: devopsConfig.get('NEWRELIC_LICENSE_KEY')
})

const envChart = new EnvironmentChart({
  namespace: `stranerd-env-${env}`,
  env,
  domain,
  issuer: infraChart.issuer ? { name: infraChart.issuer.name, kind: infraChart.issuer.kind } : undefined,
  twingateAccess: devopsConfig.get(`TWINGATE_ACCESS_${env.toUpperCase()}`, JSON.parse),
})

const common = {
  zoneId: devopsConfig.get('CLOUDFLARE_ZONE_ID'),
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
