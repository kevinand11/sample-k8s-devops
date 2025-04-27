import { Construct } from 'constructs'

export abstract class K8sConstruct extends Construct {
	abstract deploy () :Promise<void>
}