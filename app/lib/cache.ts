export interface JobState {
  id: string
  domain: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  result?: {
    nameservers: string[]
    subdomains: Array<{ name: string; type: string; value: string; source?: string }>
  }
  error?: string
  createdAt: number
  completedAt?: number
}

const JOB_TTL = 60 * 30 // 30 minutes
const RESULT_CACHE_TTL = 60 * 60 // 1 hour

export async function setJob(kv: KVNamespace, job: JobState): Promise<void> {
  await kv.put(`job:${job.id}`, JSON.stringify(job), { expirationTtl: JOB_TTL })
}

export async function getJob(kv: KVNamespace, jobId: string): Promise<JobState | null> {
  const data = await kv.get(`job:${jobId}`, { type: 'json' })
  return data as JobState | null
}

export async function getCachedResult(kv: KVNamespace, domain: string) {
  return kv.get(`dns:${domain}`, { type: 'json' })
}

export async function cacheResult(kv: KVNamespace, domain: string, result: JobState['result']): Promise<void> {
  await kv.put(`dns:${domain}`, JSON.stringify(result), { expirationTtl: RESULT_CACHE_TTL })
}
