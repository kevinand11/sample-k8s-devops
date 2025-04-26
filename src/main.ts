import { cdk8s, kplus, K8sApp, LocalDockerImage } from './lib'

export class MyChart extends cdk8s.Chart {
  constructor(scope: K8sApp, id: string) {
    super(scope, id, {
      disableResourceNameHashes: true,
      namespace: scope.env,
      labels: { env: scope.env },
    });

    new LocalDockerImage(scope, 'docker', {
      name: 'nginx',
      build: {
        context: '.'
      }
    })

    new kplus.Deployment(this, 'App', {
      containers: [{ image: 'nginx' }],
    });
  }
}

const app = new K8sApp({
  env: 'dev',
  localDockerImages: { synth: false }
});

new MyChart(app, 'devops');
app.synth();
