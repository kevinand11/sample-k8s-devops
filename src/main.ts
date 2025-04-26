import path from 'node:path'
import { cdk8s, K8sApp, kplus, LocalDockerImage, Platform } from './lib'

export class DevopsChart extends cdk8s.Chart {
  constructor(scope: K8sApp) {
    super(scope, 'devops', {
      disableResourceNameHashes: true,
      namespace: scope.env,
      labels: { env: scope.env },
    });

   /*  new cdk8s.Helm(scope, 'mongo', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/mongodb-sharded',
      version: '9.2.3',
      namespace: scope.env,
    }) */

    const image = new LocalDockerImage(this, 'docker', {
      name: 'kevinand11/k8s-demo-app',
      build: {
        context: path.resolve(__dirname, 'app'),
        platforms: [Platform.LINUX_AMD64]
      }
    })

    new kplus.Deployment(this, 'App', {
      containers: [{
        image: image.nameTag,
        securityContext: {
          ensureNonRoot: false,
          user: 0
        }
      }],
    });
  }
}

const app = new K8sApp({
  env: 'dev',
  localDockerImages: { synth: false }
});

new DevopsChart(app);
app.synth();
