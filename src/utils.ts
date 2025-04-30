import { execSync } from 'node:child_process'

import Cloudflare from 'cloudflare'
import { RecordCreateParams, RecordListParams } from 'cloudflare/src/resources/dns/index.js'

interface CloudflareDNSRecordParams {
	zoneId: string
	apiToken: string
	type: Exclude<RecordListParams['type'], undefined>
	recordName: string // e.g. "api.example.com"
	ip: string
}

export async function upsertCloudflareRecord({
	zoneId,
	apiToken,
	type,
	recordName,
	ip,
}: CloudflareDNSRecordParams): Promise<void> {
	const client = new Cloudflare({ apiToken })
	const records = await client.dns.records.list({ type, zone_id: zoneId, name: { exact: recordName } })
	const existing = records.result.at(0)

	const payload: RecordCreateParams = {
		zone_id: zoneId,
		type,
		name: recordName,
		content: ip,
		ttl: 1,
		proxied: false,
	}

	if (!existing) await client.dns.records.create(payload)
	else if (existing.content !== ip) await client.dns.records.update(existing.id, payload)
}

export async function deleteCloudflareRecord({
	zoneId,
	apiToken,
	type,
	recordName,
}: Omit<CloudflareDNSRecordParams, 'ip'>): Promise<void> {
	const client = new Cloudflare({ apiToken })
	const records = await client.dns.records.list({ type, zone_id: zoneId, name: { exact: recordName } })
	const existing = records.result.at(0)

	if (existing) await client.dns.records.delete(existing.id, { zone_id: zoneId })
}


export function getRequiredProcessEnv (name: string) {
	const value = process.env[name]
	if (!value) throw new Error(`${name} not defined in process env`)
	return value
}

export function getLoadBalancerIP(ns: string) {
  const output = execSync(`kubectl get services -n ${ns} -o json`).toString()
  const json = JSON.parse(output)
  for (const svc of json.items) {
    const type = svc.spec.type
    const ip: string = svc.status?.loadBalancer?.ingress?.[0]?.ip
    if (type === "LoadBalancer" && ip) return ip
  }
}