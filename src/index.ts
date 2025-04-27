import { DevopsChart } from './charts/DevopsChart'
import { K8sApp } from './lib'

export const app = new K8sApp({
  env: 'dev',
  namespace: 'dev'
});

new DevopsChart(app);

app.process()