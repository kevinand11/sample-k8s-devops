import { Certificate } from '@devops/k8s-cdk/cert-manager'
import { HttpRouteSpecRulesFiltersRequestRedirectScheme } from '@devops/k8s-cdk/gateway'
import { K8sChart, K8sChartProps, K8sDomain, K8sGateway, K8sHelm } from '@devops/k8s-cdk/k8s'
import { IntOrString, Service as KubeService } from '@devops/k8s-cdk/kube'
import { Capability, ContainerSecurityContextProps, Deployment, EnvValue, Service } from '@devops/k8s-cdk/plus'

import { createInternalRoute, KafkaValues, TwingateAccess } from './commons/types'

interface EnvironmentChartProps extends K8sChartProps {
  env: string
  domain: K8sDomain
  issuer?: { name: string, kind: string }
  twingateAccess: TwingateAccess
}

const securityContext: ContainerSecurityContextProps = {
  ensureNonRoot: true,
  user: 1000,
  group: 1000,
  allowPrivilegeEscalation: false,
  readOnlyRootFilesystem: true,
  "capabilities": {
    "drop": [Capability.ALL]
  }
}

export class EnvironmentChart extends K8sChart {
  private readonly gateway?: K8sGateway
  constructor(private readonly props: EnvironmentChartProps) {
    super('env', props)

    const { gateway } = this.createRouting()
    this.gateway = gateway

    this.createMongo()
    this.createRedis()
    this.createKafka()
    this.createApp()
  }

  createRouting () {
    const secretName = this.resolve('cert-manager-certificate-secret')
    const certificate = this.props.issuer ? new Certificate(this, 'cert-manager-certificate', {
      spec: {
        secretName,
        issuerRef: this.props.issuer,
        commonName: this.props.domain.common,
        dnsNames: Object.keys({
          [this.props.domain.base]: true, // root domain a.com
          [this.props.domain.common]: true, // first level wildcard *.com
          [this.props.domain.scope('*').common]: true // second level wildcard *.*.com
        })
      }
    }) : undefined

    K8sHelm.traefik(this, 'traefik', {
      values: {
        gateway: { enabled: false },
        providers: {
          kubernetesGateway: { enabled: true },
        },
        additionalArguments: ['--api.dashboard=true', '--api.insecure=true'],
      },
    })

    const service = new KubeService(this, 'traefik-internal-service', {
      spec: {
        selector: {
          'app.kubernetes.io/name': 'traefik',
          'app.kubernetes.io/instance': this.resolve(this.namespace),
        },
        ports: [{ name: 'traefik', port: 80, targetPort: IntOrString.fromString('traefik') }]
      }
    })

    const tls = certificate ? { certificateRefs: [{ name: secretName }] } : undefined

    const gateway = new K8sGateway(this, 'gateway', {
      gatewayClass: { controllerName: 'traefik.io/gateway-controller' },
      listeners: [
        { name: 'http', port: 8000, protocol: 'HTTP' },
        { name: 'https', port: 8443, protocol: 'HTTPS', tls },
      ],
    })

    gateway.addRoute(`http-route`, {
      listener: 'http',
      redirect: { scheme: HttpRouteSpecRulesFiltersRequestRedirectScheme.HTTPS }
    })

    createInternalRoute(this, { name: 'traefik', service: service.name, access: this.props.twingateAccess })

    return { gateway }
  }

  createExternalRoute (name: string, service: Service, options: { host: string, path?: string }) {
    this.gateway?.addRoute(
      `${name}-route`,
      {
        backend: { name: service.name, port: service.port },
        host: options.host,
        path: options.path,
        listener: 'https'
      }
    )
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

    const service = mongo.getTypedObject(
      (o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb',
    )!

    const statefulSet = mongo.getTypedObject(
      (o) => o.kind === 'StatefulSet' && o.metadata.getLabel('app.kubernetes.io/component') === 'mongodb',
    )!

    const hosts = new Array(replicas).fill(0).map((_, i) => this.resolveDns(`${statefulSet.name}-${i}.${service.name}`))
    const url = `mongo://${auth.rootUser}:${auth.rootPassword}@${hosts.join(',')}:27017/replicaSet=${replicaSetName}`

    const uiService= new Deployment(this, 'mongo-express', {
      replicas: 1,
      containers: [{
        image: 'mongo-express:latest',
        portNumber: 8081,
        securityContext,
        envVariables: {
          ME_CONFIG_MONGODB_SERVER: EnvValue.fromValue(service.name),
          ME_CONFIG_MONGODB_ADMINUSERNAME: EnvValue.fromValue(auth.rootUser),
          ME_CONFIG_MONGODB_ADMINPASSWORD: EnvValue.fromValue(auth.rootPassword),
          ME_CONFIG_BASICAUTH: EnvValue.fromValue('false'),
          ME_CONFIG_BASICAUTH_ENABLED: EnvValue.fromValue('false'),
        }
      }]
    }).exposeViaService({ ports: [{ port: 80, targetPort: 8081 }] })

    createInternalRoute(this, { name: 'mongo-ui', service: uiService.name, access: this.props.twingateAccess })

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

    const service = redis.getTypedObject(
      (o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'master',

    )!
    const redisHost = this.resolveDns(service.name)

    const redisUrl = `redis://${redisHost}`

    const uiService = new Deployment(this, 'redis-commander', {
      replicas: 1,
      containers: [{
        image: 'rediscommander/redis-commander:latest',
        portNumber: 8081,
        securityContext,
        envVariables: {
          REDIS_HOST: EnvValue.fromValue(redisHost),
          REDIS_PASSWORD: EnvValue.fromValue(password),
        }
      }]
    }).exposeViaService({ ports: [{ port: 80, targetPort: 8081 }] })

    createInternalRoute(this, { name: 'redis-ui', service: uiService.name, access: this.props.twingateAccess })

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

    const service = kafka.getTypedObject(
      (o) => o.kind === 'Service' && o.metadata.getLabel('app.kubernetes.io/component') === 'kafka',
    )!
    const host = `${this.resolveDns(service.name)}:9092`

    const values: KafkaValues = {
      host,
      auth: {
        securityProtocol: 'SASL_PLAINTEXT',
        saslMechanism: 'PLAIN',
        saslJaasConfig: `org.apache.kafka.common.security.plain.PlainLoginModule required username="${user}" password="${password}";`
      }
    }

    const { url: debeziumUrl } = this.createDebezium(values)

    const uiService = new Deployment(this, 'kafka-ui', {
      replicas: 1,
      containers: [{
        image: 'provectuslabs/kafka-ui:latest',
        portNumber: 8080,
        securityContext,
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
    }).exposeViaService({ ports: [{ port: 80, targetPort: 8080 }] })

    createInternalRoute(this, { name: 'kafka-ui', service: uiService.name, access: this.props.twingateAccess })

    return { values, debeziumUrl }
  }

  createDebezium (values: KafkaValues) {
    const service = new Deployment(this, 'debezium', {
      replicas: 1,
      containers: [{
        image: 'debezium/connect:2.7.3.Final',
        portNumber: 8083,
        securityContext,
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
    const service = new Deployment(this, 'traefik-whoami', {
      replicas: 1,
      containers: [{
        image: 'traefik/whoami:latest',
        envVariables: {
          WHOAMI_PORT_NUMBER: EnvValue.fromValue('8080'),
          WHOAMI_NAME: EnvValue.fromValue('Who am I?')
        },
        portNumber: 8080,
        securityContext,
      }]
    }).exposeViaService({ ports: [{ port: 80, targetPort: 8080 }] })

    this.createExternalRoute('app', service, {
      host: this.props.domain.base
    })

    return { service }
  }
}
