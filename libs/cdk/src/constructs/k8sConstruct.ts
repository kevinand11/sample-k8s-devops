import { Construct } from 'constructs'

import { AddK8sHooks } from './k8sHooks'

export class K8sConstruct extends AddK8sHooks(Construct) {}