import path from 'node:path'
import { cdk8s, K8sApp, K8sHelm, kplus, LocalDockerImage, Platform, TraefikAnnotations, TraefikMiddleware } from '../lib'

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

    this.createIngressController()
    // this.createRedis()
    this.createMongo()
    // this.createKafka()
  }

  createIngressController () {
    new cdk8s.Include(this, 'traefik-crds', {
      url: 'https://raw.githubusercontent.com/traefik/traefik/v3.3/docs/content/reference/dynamic-configuration/kubernetes-crd-definition-v1.yml',
      // url: 'https://github.com/traefik/traefik-helm-chart/releases/download/v35.1.0/traefik.yaml'
    })

    new K8sHelm(this, 'traefik-controller', {
      chart: 'oci://ghcr.io/traefik/helm/traefik',
      version: '35.1.0',
      values: {
        ingressRoute: {
          dashboard: {
            enabled: true,
            entryPoints: ['web']
          }
        },
      },
    })
  }

  createMongo () {
    const auth = {
      rootUser: 'user',
      rootPassword: 'password'
    }
    const replicas = 3
    const replicaSetName = 'rs0'

    const mongo = new K8sHelm(this, 'mongo', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/mongodb',
      version: '16.5.2',
      values: {
        architecture: 'replicaset',
        auth,
        replicaCount: replicas,
        replicaSetName,
      },
    })

    const mongoService = mongo.apiObjects.find((o) => cdk8s.ApiObject.isConstruct(o) && o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb')!
    const mongoStatefulSet = mongo.apiObjects.find((o) => cdk8s.ApiObject.isConstruct(o) && o.kind === 'StatefulSet' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb')!

    const hosts = new Array(replicas).fill(0).map((_, i) => `${mongoStatefulSet.name}-${i}.${mongoService.name}.${this.scope.namespace}.svc.cluster.local`)
    const url = `mongo://${auth.rootUser}:${auth.rootPassword}@${hosts.join(',')}:27017/replicaSet=${replicaSetName}`

    const ingress= new kplus.Deployment(this, 'mongo-express', {
      replicas: 1,
      containers: [{
        image: 'mongo-express:latest',
        portNumber: 8081,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          ME_CONFIG_MONGODB_SERVER: kplus.EnvValue.fromValue(mongoService.name),
          ME_CONFIG_MONGODB_ADMINUSERNAME: kplus.EnvValue.fromValue(auth.rootUser),
          ME_CONFIG_MONGODB_ADMINPASSWORD: kplus.EnvValue.fromValue(auth.rootPassword),
        }
      }]
    }).exposeViaIngress('/mongo-express')

    const stripPrefixMiddleware = new TraefikMiddleware(this, 'mongo-express-strip-prefix-middleware', {
      stripPrefix: {
        prefixes: ['/mongo-express']
      }
    })

    new TraefikAnnotations(this, 'mongo-express-traefik-annotations', {
      ingress,
      annotations: {
        'router.entryPoints': 'web',
        'router.middlewares': stripPrefixMiddleware.middlewareName,
      }
    })

    return { url }
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
    const redisHost = `${masterRedisService.name}.${this.scope.namespace}.svc.cluster.local`

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

  createKafka () {
    new K8sHelm(this, 'kafka', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/kafka',
      version: '32.2.1',
      values: {
        replicaCount: 2,
      },
    })

    const hosts = `kafka.${this.scope.namespace}.svc.cluster.local`

    new kplus.Deployment(this, 'kafka-ui', {
      replicas: 1,
      containers: [{
        image: 'provectuslabs/kafka-ui:master',
        portNumber: 8080,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          KAFKA_CLUSTERS_0_NAME: kplus.EnvValue.fromValue('local'),
          KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kplus.EnvValue.fromValue(hosts),
          KAFKA_CLUSTERS_0_PROPERTIES_SECURITY_PROTOCOL: kplus.EnvValue.fromValue('PLAINTEXT'),
        }
      }]
    }).exposeViaService({
      serviceType: kplus.ServiceType.NODE_PORT,
      ports: [{ port: 30003, targetPort: 8080, nodePort: 30003 }]
    })
  }
}
