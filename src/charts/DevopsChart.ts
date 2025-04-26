import path from 'node:path'
import { cdk8s, K8sApp, K8sHelm, kplus, LocalDockerImage, Platform } from '../lib'

export class DevopsChart extends cdk8s.Chart {
  constructor(private readonly scope: K8sApp) {
    super(scope, 'devops', {
      disableResourceNameHashes: true,
      namespace: scope.namespace,
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

    this.createRedis()


    /*

    new K8sHelm(this, 'mongo', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/mongodb',
      version: '16.5.2',
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

    new K8sHelm(this, 'kafka', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/kafka',
      version: '32.2.1',
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

  createRedis () {
    const password = 'password'

    const redis = new K8sHelm(this, 'redis', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/redis',
      version: '20.13.2',
      values: {
        auth: {
          enabled: false
        },
      },
    })

    const masterRedisService = redis.apiObjects.find((o) => kplus.Service.isConstruct(o) && o.kind === 'Service' && o.name.includes('master'))!
    const redisHost = `${masterRedisService.name}.${this.scope.env}.svc.cluster.local`

    const redisUrl = `redis://${redisHost}`

    new kplus.Deployment(this, 'redis-commander', {
      replicas: 1,
      containers: [{
        image: 'rediscommander/redis-commander:latest',
        portNumber: 8081,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          REDIS_HOSTS: kplus.EnvValue.fromValue(redisHost),
          REDIS_PASSWORD: kplus.EnvValue.fromValue(password),
        }
      }]
    }).exposeViaService({
      serviceType: kplus.ServiceType.NODE_PORT,
      ports: [{ port: 30002, targetPort: 8081, nodePort: 30002 }],
    })

    return { redisUrl }
  }
}
