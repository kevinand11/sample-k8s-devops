import { App, Chart } from 'cdk8s'
import * as kplus from 'cdk8s-plus-32'
import { Construct } from 'constructs'

const env = 'dev'

class Docker extends Construct { }


export class MyChart extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      namespace: env,
      labels: {
        env
      },
      disableResourceNameHashes: true
    });

    this.addDependency


    const docker = new Docker(scope, 'docker')

    new kplus.Deployment(this, 'App', {
      containers: [{ image: 'nginx' }],
    });
  }
}

const app = new App();
new MyChart(app, 'devops');
app.synth();
