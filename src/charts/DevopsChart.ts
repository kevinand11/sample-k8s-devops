import path from 'node:path'

import { Certificate } from '@devops/k8s-cdk/cert-manager'
import { HttpRouteSpecRulesFiltersRequestRedirectScheme } from '@devops/k8s-cdk/gateway'
import { K8sChart, K8sChartProps, K8sDockerImage, K8sDockerPlatform, K8sDomain, K8sDomainProps, K8sGateway, K8sGatewayCRDs, K8sHelm, K8sTraefikHelm } from '@devops/k8s-cdk/k8s'
import { KubeService, KubeStatefulSet } from '@devops/k8s-cdk/kube'
import { Deployment, EnvValue } from '@devops/k8s-cdk/plus'

interface DevopsChartProps extends K8sChartProps {
  domain: K8sDomainProps
  issuer?: { name: string, kind: string }
}

export class DevopsChart extends K8sChart {
  readonly domain: K8sDomain
  constructor(private readonly props: DevopsChartProps) {
    super('devops', props)

    const domain = new K8sDomain(props.domain)
    this.domain = domain
    const gateway = this.createGateway()

    const { service: mongoUiService } = this.createMongo()
    const { service: redisUiService } = this.createRedis()
    const { service: kafkaUiService } = this.createKafka()
    const { service: appService } = this.createApp()

    const routes = [
      { name: 'app', service: appService, host: domain.base },
      { name: 'mongo', service: mongoUiService, host: domain.sub('mongo') },
      { name: 'redis', service: redisUiService, host: domain.sub('redis') },
      { name: 'kafka', service: kafkaUiService, host: domain.sub('kafka') },
    ]

    for (const route of routes) {
      gateway.addRoute(
        `${route.name}-https-route`,
        {
          listener: 'https',
          backend: { name: route.service.name, port: route.service.port },
          host: route.host
        }
      )
    }

    gateway.addRoute(`http-route`, {
      listener: 'http',
      redirect: { scheme: HttpRouteSpecRulesFiltersRequestRedirectScheme.HTTPS }
    })

    gateway.addRoute(
      `traefik-dashboard-route`,
      {
        listener: 'https',
        backend: { name: 'api@internal', kind: 'TraefikService' },
        host: domain.sub('traefik')
      }
    )
  }

  createGateway () {
    const secretName = this.resolve('cert-manager-certificate-secret')
    const certificate = this.props.issuer ? new Certificate(this, 'cert-manager-certificate', {
      spec: {
        secretName,
        issuerRef: this.props.issuer,
        commonName: this.domain.common,
        dnsNames: Object.keys({ [this.domain.base]: true, [this.domain.common]: true })
      }
    }) : undefined

    new K8sTraefikHelm(this, 'traefik', {
      values: {
        gateway: { enabled: false },
        providers: {
          kubernetesGateway: { enabled: true },
        }
      },
    })

    new K8sGatewayCRDs(this, 'gateway-crds')

    const tls = certificate ? { certificateRefs: [{ name: secretName }] } : undefined

    return new K8sGateway(this, 'gateway', {
      gatewayClass: { controllerName: 'traefik.io/gateway-controller' },
      listeners: [
        { name: 'http', port: 8000, protocol: 'HTTP' },
        { name: 'https', port: 8443, protocol: 'HTTPS', tls },
      ],
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

    const service = mongo.getTypedObject<KubeService>(
      (o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb',
    )!

    const statefulSet = mongo.getTypedObject<KubeStatefulSet>(
      (o) => o.kind === 'StatefulSet' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb',
    )!

    const hosts = new Array(replicas).fill(0).map((_, i) => `${statefulSet.name}-${i}.${service.name}.${this.namespace}.svc.cluster.local`)
    const url = `mongo://${auth.rootUser}:${auth.rootPassword}@${hosts.join(',')}:27017/replicaSet=${replicaSetName}`

    const publicService= new Deployment(this, 'mongo-express', {
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
    }).exposeViaService()

    return { url, service: publicService }
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

    const publicService = new Deployment(this, 'redis-commander', {
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
    }).exposeViaService()

    return { redisUrl, service: publicService }
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

    const publicService = new Deployment(this, 'kafka-ui', {
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
    }).exposeViaService()

    return { values, debeziumUrl, service: publicService }
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

  createApp () {
    new K8sDockerImage(this, 'docker', {
      name: 'kevinand11/k8s-demo-app',
      tag: 'latest',
      build: {
        context: path.resolve(__dirname, '../app'),
        platforms: [K8sDockerPlatform.LINUX_AMD64]
      }
    })

    const service = new Deployment(this, 'traefik-whoami', {
      replicas: 1,
      containers: [{
        image: 'traefik/whoami:latest',
        portNumber: 80,
        securityContext: { ensureNonRoot: false, user: 0 },
      }]
    }).exposeViaService()

    return { service }
  }
}

type KafkaValues = {
  host: string
  auth: {
    securityProtocol: string
    saslMechanism: string
    saslJaasConfig: string
  }
}