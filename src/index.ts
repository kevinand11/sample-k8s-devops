import { DevopsChart } from './charts/DevopsChart'
import { createCli, K8sApp } from './lib'

export const app = new K8sApp({
  env: 'dev',
  localDockerImages: { synth: false }
});

new DevopsChart(app);

createCli(app)