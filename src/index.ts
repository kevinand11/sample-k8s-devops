import { K8sApp } from '@devops/k8s-cdk'
import { DevopsChart } from './charts/DevopsChart'
import { InfraChart } from './charts/InfraChart'

const infraChart = new InfraChart({
  namespace: 'infra',
  domain: {
    name: 'stranerd.com',
    certEmail: 'kevinfizu@gmail.com',
    wildcard: true,
  }
})

const devopsChart = new DevopsChart({
  namespace: 'dev',
  certSecretName: infraChart.certSecretName
})


new K8sApp([infraChart, devopsChart]).process()
