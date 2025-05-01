import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { Yaml } from 'cdk8s'

import { exec } from '../common/utils'
import { K8sCRDs } from '../constructs'

async function genUrl (url: string) {
	await exec(`pnpm exec cdk8s import -s=false --no-class-prefix ${url}`)
}

async function main () {

	const ignore = ['length', 'name', 'prototype']
	const keys = Object.getOwnPropertyNames(K8sCRDs)
		.filter((key) => typeof (K8sCRDs as any)[key] === 'function' && !ignore.includes(key))

	const crdGroups = keys.map((key) => (K8sCRDs)[key]?.() as string[]).filter(Boolean)

	for (const group of [['k8s'], ...crdGroups]) {
		if (group.length === 1) await genUrl(group[0])
		else {
			const mergePath = path.resolve(os.tmpdir(), `${crypto.randomUUID()}.yml`)
			const items = group.flatMap(Yaml.load)
			Yaml.save(mergePath, items)
			await genUrl(mergePath)
			await fs.rm(mergePath)
		}
	}
}

main()