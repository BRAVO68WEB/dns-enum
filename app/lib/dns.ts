import { getDnsRecords } from '@layered/dns-records'
import type { DnsRecord } from '@layered/dns-records'
import { loadWordlist } from './wordlist-loader'

export interface SubdomainResult {
  name: string
  type: string
  value: string
  source?: string
}

export interface QueryResult {
  domain: string
  nameservers: string[]
  subdomains: SubdomainResult[]
  error?: string
}

export function isValidDomain(domain: string): boolean {
  const regex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/
  return regex.test(domain.toLowerCase())
}

export async function queryNS(domain: string): Promise<string[]> {
  try {
    const records = await getDnsRecords(domain, 'NS')
    return records.map((r: DnsRecord) => r.data)
  } catch {
    return []
  }
}

// Passive DNS via crt.sh (Certificate Transparency)
async function fetchCrtSh(domain: string): Promise<SubdomainResult[]> {
  try {
    const resp = await fetch(`https://crt.sh/?q=%.${domain}&output=json`, {
      headers: { 'Accept': 'application/json' }
    })
    if (!resp.ok) return []
    
    const data = await resp.json() as Array<{ name_value: string }>
    const unique = new Set<string>()
    
    for (const entry of data) {
      const names = entry.name_value.split('\n')
      for (const name of names) {
        const clean = name.trim().toLowerCase()
        if (clean && clean.endsWith(domain)) {
          unique.add(clean)
        }
      }
    }
    
    return Array.from(unique).map(name => ({
      name,
      type: 'CERT',
      value: 'Certificate Transparency',
      source: 'crt.sh'
    }))
  } catch {
    return []
  }
}

// Passive DNS via HackerTarget
async function fetchHackerTarget(domain: string): Promise<SubdomainResult[]> {
  try {
    const resp = await fetch(`https://api.hackertarget.com/hostsearch/?q=${domain}`)
    if (!resp.ok) return []
    const text = await resp.text()
    if (text.includes('error') || text.includes('ERROR')) return []
    
    return text.split('\n').filter(line => line.includes(',')).map(line => {
      const [hostname] = line.split(',')
      return {
        name: hostname.trim().toLowerCase(),
        type: 'A',
        value: 'HackerTarget',
        source: 'hackertarget'
      }
    }).filter(s => s.name.endsWith(domain))
  } catch {
    return []
  }
}

// Passive DNS via Anubis
async function fetchAnubis(domain: string): Promise<SubdomainResult[]> {
  try {
    const resp = await fetch(`https://jldc.me/anubis/subdomains/${domain}`)
    if (!resp.ok) return []
    const data = await resp.json() as string[]
    
    return data.map(name => ({
      name: name.trim().toLowerCase(),
      type: 'A',
      value: 'Anubis',
      source: 'anubis'
    })).filter(s => s.name.endsWith(domain))
  } catch {
    return []
  }
}

// Brute force subdomains using wordlist + DNS resolution
async function fetchBruteSubdomains(domain: string, maxEntries?: number): Promise<SubdomainResult[]> {
  const wordlist = loadWordlist(maxEntries || 1000)
  const results: SubdomainResult[] = []
  const concurrency = 100
  
  for (let i = 0; i < wordlist.length; i += concurrency) {
    const batch = wordlist.slice(i, i + concurrency)
    const promises = batch.map(async (sub) => {
      const fqdn = `${sub}.${domain}`
      try {
        const records = await getDnsRecords(fqdn, 'A')
        if (records.length > 0) {
          return records.map((r: DnsRecord) => ({
            name: fqdn,
            type: r.type,
            value: r.data,
            source: 'wordlist'
          }))
        }
      } catch {}
      return []
    })
    
    const batchResults = await Promise.all(promises)
    for (const r of batchResults) {
      results.push(...r)
    }
  }
  
  return results
}

// Merge and deduplicate subdomains from multiple sources
function mergeSubdomains(...sources: SubdomainResult[][]): SubdomainResult[] {
  const map = new Map<string, SubdomainResult>()
  
  for (const source of sources) {
    for (const sub of source) {
      const key = `${sub.name}:${sub.type}`
      if (!map.has(key)) {
        map.set(key, sub)
      }
    }
  }
  
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function enumerateSubdomains(domain: string, maxWordlistEntries?: number): Promise<SubdomainResult[]> {
  const [crtResults, hackerTargetResults, anubisResults, bruteResults] = await Promise.all([
    fetchCrtSh(domain),
    fetchHackerTarget(domain),
    fetchAnubis(domain),
    fetchBruteSubdomains(domain, maxWordlistEntries),
  ])
  
  return mergeSubdomains(crtResults, hackerTargetResults, anubisResults, bruteResults)
}

export async function queryDomain(domain: string, maxWordlistEntries?: number): Promise<QueryResult> {
  if (!isValidDomain(domain)) {
    return { domain, nameservers: [], subdomains: [], error: 'Invalid domain format' }
  }

  const [nameservers, subdomains] = await Promise.all([
    queryNS(domain),
    enumerateSubdomains(domain, maxWordlistEntries),
  ])

  return { domain, nameservers, subdomains }
}
