import { DevopsChart } from './charts/DevopsChart'
import { K8sApp } from './lib'

export const app = new K8sApp({
  env: 'dev',
  localDockerImages: { synth: false }
});

new DevopsChart(app);

app.process()