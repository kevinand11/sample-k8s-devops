import path from 'node:path'
import { cdk8s, K8sApp, K8sHelm, kplus, LocalDockerImage, Platform, TraefikAnnotations, TraefikMiddleware } from '../lib'

type KafkaValues = {
  host: string
  auth: {
    securityProtocol: string
    saslMechanism: string
    saslJaasConfig: string
  }
}

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
    this.createMongo()
    this.createRedis()
    this.createKafka()
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
        ports: {
          traefik: {
            expose: { default: true }, // disable for prod
            exposedPort: 90,
          }
        },
        ingressRoute: {
          dashboard: {
            enabled: true,
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

    const service = mongo.apiObjects.find((o) => cdk8s.ApiObject.isConstruct(o) && o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb')!
    const statefulSet = mongo.apiObjects.find((o) => cdk8s.ApiObject.isConstruct(o) && o.kind === 'StatefulSet' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb')!

    const hosts = new Array(replicas).fill(0).map((_, i) => `${statefulSet.name}-${i}.${service.name}.${this.scope.namespace}.svc.cluster.local`)
    const url = `mongo://${auth.rootUser}:${auth.rootPassword}@${hosts.join(',')}:27017/replicaSet=${replicaSetName}`

    const ingress= new kplus.Deployment(this, 'mongo-express', {
      replicas: 1,
      containers: [{
        image: 'mongo-express:latest',
        portNumber: 8081,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          ME_CONFIG_MONGODB_SERVER: kplus.EnvValue.fromValue(service.name),
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

    const service = redis.apiObjects.find((o) => kplus.Service.isConstruct(o) && o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'master')!
    const redisHost = `${service.name}.${this.scope.namespace}.svc.cluster.local`

    const redisUrl = `redis://${redisHost}`

    const ingress = new kplus.Deployment(this, 'redis-commander', {
      replicas: 1,
      containers: [{
        image: 'rediscommander/redis-commander:latest',
        portNumber: 8081,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          REDIS_HOST: kplus.EnvValue.fromValue(redisHost),
          REDIS_PASSWORD: kplus.EnvValue.fromValue(password),
        }
      }]
    }).exposeViaIngress('/redis-commander')

    const stripPrefixMiddleware = new TraefikMiddleware(this, 'redis-commander-strip-prefix-middleware', {
      stripPrefix: {
        prefixes: ['/redis-commander']
      }
    })

    new TraefikAnnotations(this, 'redis-commander-traefik-annotations', {
      ingress,
      annotations: {
        'router.entryPoints': 'web',
        'router.middlewares': stripPrefixMiddleware.middlewareName,
      }
    })

    return { redisUrl }
  }

  createKafka () {
    const user = 'user'
    const password = 'password'

    const kafka = new K8sHelm(this, 'kafka', {
      chart: 'oci://registry-1.docker.io/bitnamicharts/kafka',
      version: '32.2.1',
      values: {
        sasl: {
          client: {
            users: [user],
            passwords: password
          }
        }
      },
    })

    const service = kafka.apiObjects.find((o) => kplus.Service.isConstruct(o) && o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'kafka')!
    const host = `${service.name}.${this.scope.namespace}.svc.cluster.local:9092`

    const values: KafkaValues = {
      host,
      auth: {
        securityProtocol: 'SASL_PLAINTEXT',
        saslMechanism: 'PLAIN',
        saslJaasConfig: `org.apache.kafka.common.security.plain.PlainLoginModule required username="${user}" password="${password}";`
      }
    }

    const { url: debeziumUrl } = this.createDebezium(values)

    const ingress = new kplus.Deployment(this, 'kafka-ui', {
      replicas: 1,
      containers: [{
        image: 'provectuslabs/kafka-ui:latest',
        portNumber: 8080,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          KAFKA_CLUSTERS_0_NAME: kplus.EnvValue.fromValue('local'),
          KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kplus.EnvValue.fromValue(values.host),
          KAFKA_CLUSTERS_0_PROPERTIES_SECURITY_PROTOCOL: kplus.EnvValue.fromValue(values.auth.securityProtocol),
          KAFKA_CLUSTERS_0_PROPERTIES_SASL_MECHANISM: kplus.EnvValue.fromValue(values.auth.saslMechanism),
          KAFKA_CLUSTERS_0_PROPERTIES_SASL_JAAS_CONFIG: kplus.EnvValue.fromValue(values.auth.saslJaasConfig),
          KAFKA_CLUSTERS_0_KAFKACONNECT_0_NAME: kplus.EnvValue.fromValue('debezium'),
          KAFKA_CLUSTERS_0_KAFKACONNECT_0_ADDRESS: kplus.EnvValue.fromValue(debeziumUrl),
          DYNAMIC_CONFIG_ENABLED: kplus.EnvValue.fromValue('true'),
        }
      }]
    }).exposeViaIngress('/kafka-ui')

    const stripPrefixMiddleware = new TraefikMiddleware(this, 'kafka-ui-strip-prefix-middleware', {
      stripPrefix: {
        prefixes: ['/kafka-ui']
      }
    })

    new TraefikAnnotations(this, 'kafka-ui-traefik-annotations', {
      ingress,
      annotations: {
        'router.entryPoints': 'web',
        'router.middlewares': stripPrefixMiddleware.middlewareName,
      }
    })

    return { values, debeziumUrl }
  }

  createDebezium (values: KafkaValues) {
    const service = new kplus.Deployment(this, 'debezium', {
      replicas: 1,
      containers: [{
        image: 'debezium/connect:2.7.3.Final',
        portNumber: 8083,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          GROUP_ID: kplus.EnvValue.fromValue(`${this.namespace}-${this.node.id}`),
          BOOTSTRAP_SERVERS: kplus.EnvValue.fromValue(values.host),
          CONNECT_SECURITY_PROTOCOL: kplus.EnvValue.fromValue(values.auth.securityProtocol),
          CONNECT_SASL_MECHANISM: kplus.EnvValue.fromValue(values.auth.saslMechanism),
          CONNECT_SASL_JAAS_CONFIG: kplus.EnvValue.fromValue(values.auth.saslJaasConfig),

          CONFIG_STORAGE_TOPIC: kplus.EnvValue.fromValue('debezium.connect.config'),
          OFFSET_STORAGE_TOPIC: kplus.EnvValue.fromValue('debezium.connect.offset'),
          STATUS_STORAGE_TOPIC: kplus.EnvValue.fromValue('debezium.connect.status'),
          CONFIG_STORAGE_REPLICATION_FACTOR: kplus.EnvValue.fromValue('3'),
          OFFSET_STORAGE_REPLICATION_FACTOR: kplus.EnvValue.fromValue('3'),
          STATUS_STORAGE_REPLICATION_FACTOR: kplus.EnvValue.fromValue('3'),
        }
      }]
    }).exposeViaService()

    const url = `http://${service.name}:${service.port}`

    return { url }
  }
}
