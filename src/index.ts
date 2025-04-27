import { K8sApp, K8sCli } from '@devops/k8s-cdk'
import { DevopsChart } from './charts/DevopsChart'
import { InfraChart } from './charts/InfraChart'

const infraApp = new K8sApp({
  env: 'infra',
  namespace: 'infra',
})

const devopsApp = new K8sApp({
  env: 'dev',
  namespace: 'dev'
});

const infraChart = new InfraChart(infraApp, {
  domain: {
    name: 'stranerd.com',
    certEmail: 'kevinfizu@gmail.com',
    wildcard: true,
  }
})

new DevopsChart(devopsApp, {
  certSecretName: infraChart.certSecretName
});

new K8sCli({ infra: infraApp, devops: devopsApp }).process()