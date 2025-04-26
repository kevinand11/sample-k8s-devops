import path from 'node:path'
import { cdk8s, K8sApp, kplus, LocalDockerImage, Platform } from '../lib'

export class DevopsChart extends cdk8s.Chart {
  constructor(scope: K8sApp) {
    super(scope, 'devops', {
      disableResourceNameHashes: true,
      namespace: scope.env,
      labels: { env: scope.env },
    });

    const image = new LocalDockerImage(this, 'docker', {
      name: 'kevinand11/k8s-demo-app',
      build: {
        context: path.resolve(__dirname, '../app'),
        platforms: [Platform.LINUX_AMD64]
      }
    })

    new kplus.Deployment(this, 'App', {
      replicas: 1,
      containers: [{
        image: image.nameTag,
        securityContext: { ensureNonRoot: false, user: 0 },
      }],
    });

    /* new cdk8s.Helm(this, 'redis', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/redis',
      version: '20.13.2',
      namespace: scope.env,
      values: {
        auth: {
          password: 'password'
        },
      },
    })

    new cdk8s.Helm(this, 'mongo', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/mongodb',
      version: '16.5.2',
      namespace: scope.env,
      values: {
        architecture: 'replicaset',
        auth: {
          rootUser: 'user',
          rootPassword: 'password'
        },
        replicaCount: 3,
        replicaSetName: 'rs0',
      },
    })

    new cdk8s.Helm(this, 'kafka', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/kafka',
      version: '32.2.1',
      namespace: scope.env,
      values: {
        replicaCount: 2,
      },
    })

    new kplus.Deployment(this, 'mongo-express', {
      replicas: 1,
      containers: [{
        image: 'mongo-express:latest',
        portNumber: 8081,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          ME_CONFIG_MONGODB_SERVER: kplus.EnvValue.fromValue(`mongo.${scope.env}.svc.cluster.local`),
          ME_CONFIG_MONGODB_ADMINUSERNAME: kplus.EnvValue.fromValue('root'),
          ME_CONFIG_MONGODB_ADMINPASSWORD: kplus.EnvValue.fromValue('password'),
        }
      }]
    }).exposeViaService({
      serviceType: kplus.ServiceType.NODE_PORT,
      ports: [{ port: 30001, targetPort: 8081, nodePort: 30001 }]
    })

    new kplus.Deployment(this, 'redis-commander', {
      replicas: 1,
      containers: [{
        image: 'rediscommander/redis-commander:latest',
        portNumber: 8081,
        securityContext: { ensureNonRoot: false, user: 0 },
      }]
    }).exposeViaService({
      serviceType: kplus.ServiceType.NODE_PORT,
      ports: [{ port: 30002, targetPort: 8081, nodePort: 30002 }]
    })

    new kplus.Deployment(this, 'kafka-ui', {
      replicas: 1,
      containers: [{
        image: 'provectuslabs/kafka-ui:master',
        portNumber: 8080,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          KAFKA_CLUSTERS_0_NAME: kplus.EnvValue.fromValue('local'),
          KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kplus.EnvValue.fromValue('kafka-uris'),
        }
      }]
    }).exposeViaService({
      serviceType: kplus.ServiceType.NODE_PORT,
      ports: [{ port: 30003, targetPort: 8080, nodePort: 30003 }]
    }) */
  }
}
