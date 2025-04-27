import { DevopsChart } from './charts/DevopsChart'
import { InfraChart } from './charts/InfraChart'
import { K8sApp } from './lib'

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


(async () => {
  await infraApp.process()
  await devopsApp.process()
})()