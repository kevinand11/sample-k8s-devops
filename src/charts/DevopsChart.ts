import { K8sChart, K8sChartProps, K8sDockerImage, K8sDockerPlatform, K8sHelm, K8sTraefikAnnotations, K8sTraefikHelm, K8sTraefikMiddleware } from '@devops/k8s-cdk'
import { KubeService, KubeStatefulSet } from '@devops/k8s-cdk/kube'
import { Deployment, EnvValue } from '@devops/k8s-cdk/plus'
import path from 'node:path'

type KafkaValues = {
  host: string
  auth: {
    securityProtocol: string
    saslMechanism: string
    saslJaasConfig: string
  }
}

interface DevopsChartProps extends K8sChartProps {
  certSecretName?: string
}

export class DevopsChart extends K8sChart {
  constructor(private readonly props: DevopsChartProps) {
    super('devops', props);

    const image = new K8sDockerImage(this, 'docker', {
      name: 'kevinand11/k8s-demo-app',
      build: {
        context: path.resolve(__dirname, '../app'),
        platforms: [K8sDockerPlatform.LINUX_AMD64]
      }
    })

    new Deployment(this, 'App', {
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
    const traefik = new K8sTraefikHelm(this, 'traefik-controller', {
      values: {
        ports: {
          web: {
            redirections: {
              entryPoint: {
                to: 'websecure',
                scheme: 'https',
                permanent: true,
              }
            },
            asDefault: true,
          },
          websecure: {
            asDefault: true,
          }
        },
        ingressRoute: {
          dashboard: {
            enabled: true,
            entryPoints: ['web', 'websecure']
          }
        },
      },
      installCRDs: true,
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
        auth: {
          ...auth,
          replicaSetKey: replicaSetName
        },
        replicaCount: replicas,
        replicaSetName,
      },
    })

    const service = mongo.getTypedObject<KubeService>(
      (o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb',
    )!

    const statefulSet = mongo.getTypedObject<KubeStatefulSet>(
      (o) => o.kind === 'StatefulSet' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb',
    )!

    const hosts = new Array(replicas).fill(0).map((_, i) => `${statefulSet.name}-${i}.${service.name}.${this.namespace}.svc.cluster.local`)
    const url = `mongo://${auth.rootUser}:${auth.rootPassword}@${hosts.join(',')}:27017/replicaSet=${replicaSetName}`

    const ingress= new Deployment(this, 'mongo-express', {
      replicas: 1,
      containers: [{
        image: 'mongo-express:latest',
        portNumber: 8081,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          ME_CONFIG_MONGODB_SERVER: EnvValue.fromValue(service.name),
          ME_CONFIG_MONGODB_ADMINUSERNAME: EnvValue.fromValue(auth.rootUser),
          ME_CONFIG_MONGODB_ADMINPASSWORD: EnvValue.fromValue(auth.rootPassword),
        }
      }]
    }).exposeViaIngress('/mongo-express')

    const stripPrefixMiddleware = new K8sTraefikMiddleware(this, 'mongo-express-strip-prefix-middleware', {
      stripPrefix: {
        prefixes: ['/mongo-express']
      }
    })

    K8sTraefikAnnotations.build()
      .addMiddleware(stripPrefixMiddleware)
      .collect(ingress)

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

    const service = redis.getTypedObject<KubeService>(
      (o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'master',

    )!
    const redisHost = `${service.name}.${this.namespace}.svc.cluster.local`

    const redisUrl = `redis://${redisHost}`

    const ingress = new Deployment(this, 'redis-commander', {
      replicas: 1,
      containers: [{
        image: 'rediscommander/redis-commander:latest',
        portNumber: 8081,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          REDIS_HOST: EnvValue.fromValue(redisHost),
          REDIS_PASSWORD: EnvValue.fromValue(password),
        }
      }]
    }).exposeViaIngress('/redis-commander')

    const stripPrefixMiddleware = new K8sTraefikMiddleware(this, 'redis-commander-strip-prefix-middleware', {
      stripPrefix: {
        prefixes: ['/redis-commander']
      }
    })

    K8sTraefikAnnotations.build()
      .addMiddleware(stripPrefixMiddleware)
      .collect(ingress)

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

    const service = kafka.getTypedObject<KubeService>(
      (o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'kafka',
    )!
    const host = `${service.name}.${this.namespace}.svc.cluster.local:9092`

    const values: KafkaValues = {
      host,
      auth: {
        securityProtocol: 'SASL_PLAINTEXT',
        saslMechanism: 'PLAIN',
        saslJaasConfig: `org.apache.kafka.common.security.plain.PlainLoginModule required username="${user}" password="${password}";`
      }
    }

    const { url: debeziumUrl } = this.createDebezium(values)

    const ingress = new Deployment(this, 'kafka-ui', {
      replicas: 1,
      containers: [{
        image: 'provectuslabs/kafka-ui:latest',
        portNumber: 8080,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          KAFKA_CLUSTERS_0_NAME: EnvValue.fromValue('local'),
          KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: EnvValue.fromValue(values.host),
          KAFKA_CLUSTERS_0_PROPERTIES_SECURITY_PROTOCOL: EnvValue.fromValue(values.auth.securityProtocol),
          KAFKA_CLUSTERS_0_PROPERTIES_SASL_MECHANISM: EnvValue.fromValue(values.auth.saslMechanism),
          KAFKA_CLUSTERS_0_PROPERTIES_SASL_JAAS_CONFIG: EnvValue.fromValue(values.auth.saslJaasConfig),
          KAFKA_CLUSTERS_0_KAFKACONNECT_0_NAME: EnvValue.fromValue('debezium'),
          KAFKA_CLUSTERS_0_KAFKACONNECT_0_ADDRESS: EnvValue.fromValue(debeziumUrl),
          DYNAMIC_CONFIG_ENABLED: EnvValue.fromValue('true'),
        }
      }]
    }).exposeViaIngress('/kafka-ui')

    const stripPrefixMiddleware = new K8sTraefikMiddleware(this, 'kafka-ui-strip-prefix-middleware', {
      stripPrefix: {
        prefixes: ['/kafka-ui']
      }
    })

    K8sTraefikAnnotations.build()
      .addMiddleware(stripPrefixMiddleware)
      .collect(ingress)

    return { values, debeziumUrl }
  }

  createDebezium (values: KafkaValues) {
    const service = new Deployment(this, 'debezium', {
      replicas: 1,
      containers: [{
        image: 'debezium/connect:2.7.3.Final',
        portNumber: 8083,
        securityContext: { ensureNonRoot: false, user: 0 },
        envVariables: {
          GROUP_ID: EnvValue.fromValue(this.node.id),
          BOOTSTRAP_SERVERS: EnvValue.fromValue(values.host),
          CONNECT_SECURITY_PROTOCOL: EnvValue.fromValue(values.auth.securityProtocol),
          CONNECT_SASL_MECHANISM: EnvValue.fromValue(values.auth.saslMechanism),
          CONNECT_SASL_JAAS_CONFIG: EnvValue.fromValue(values.auth.saslJaasConfig),

          CONFIG_STORAGE_TOPIC: EnvValue.fromValue('debezium.connect.config'),
          OFFSET_STORAGE_TOPIC: EnvValue.fromValue('debezium.connect.offset'),
          STATUS_STORAGE_TOPIC: EnvValue.fromValue('debezium.connect.status'),
          CONFIG_STORAGE_REPLICATION_FACTOR: EnvValue.fromValue('3'),
          OFFSET_STORAGE_REPLICATION_FACTOR: EnvValue.fromValue('3'),
          STATUS_STORAGE_REPLICATION_FACTOR: EnvValue.fromValue('3'),
        }
      }]
    }).exposeViaService()

    const url = `http://${service.name}:${service.port}`

    return { url }
  }
}
