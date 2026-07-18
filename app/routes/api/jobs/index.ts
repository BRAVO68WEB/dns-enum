import { createRoute } from 'honox/factory'
import { getCookie, setCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { isValidDomain } from '../../../lib/dns'
import { setJob, getCachedResult, cacheResult, getJob, type JobState } from '../../../lib/cache'
import { nanoid } from '../../../lib/nanoid'

const ANON_CACHED_LIMIT = 2

async function isAuthenticated(c: any): Promise<boolean> {
  const token = getCookie(c, 'session')
  if (!token) return false
  try {
    await verify(token, c.env.JWT_SECRET, 'HS256')
    return true
  } catch {
    return false
  }
}

export const POST = createRoute(async (c) => {
  const body = await c.req.json<{ domain: string; force?: boolean }>()
  const domain = body.domain?.toLowerCase().trim()
  const force = body.force === true

  if (!domain || !isValidDomain(domain)) {
    return c.json({ error: 'Invalid domain format' }, 400)
  }

  const authed = await isAuthenticated(c)

  if (!force) {
    const cached = await getCachedResult(c.env.CACHE_KV, domain)
    if (cached) {
      if (!authed) {
        const searchCount = parseInt(getCookie(c, 'search_count') || '0', 10)
        if (searchCount >= ANON_CACHED_LIMIT) {
          return c.json({ error: 'auth_required', message: 'Sign in to search more domains' }, 401)
        }
        setCookie(c, 'search_count', String(searchCount + 1), {
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          maxAge: 86400,
        })
      }
      return c.json({ id: `cached-${domain}`, domain, status: 'complete', result: cached, fromCache: true })
    }
  }

  if (!authed) {
    return c.json({ error: 'auth_required', message: 'Sign in to search new domains' }, 401)
  }

  const job: JobState = {
    id: nanoid(12),
    domain,
    status: 'pending',
    createdAt: Date.now(),
  }

  await setJob(c.env.CACHE_KV, job)

  c.executionCtx.waitUntil(processJobInBackground(c.env.CACHE_KV, job.id, domain))

  return c.json({ id: job.id, domain: job.domain, status: job.status }, 202)
})

async function processJobInBackground(kv: KVNamespace, jobId: string, domain: string) {
  const job = await getJob(kv, jobId)
  if (!job) return

  job.status = 'processing'
  await setJob(kv, job)

  try {
    const { queryDomain } = await import('../../../lib/dns')
    const result = await queryDomain(domain, 1000)
    job.status = 'complete'
    job.result = { nameservers: result.nameservers, subdomains: result.subdomains }
    job.completedAt = Date.now()
    await cacheResult(kv, domain, job.result)
  } catch (err) {
    job.status = 'error'
    job.error = err instanceof Error ? err.message : 'DNS query failed'
    job.completedAt = Date.now()
  }

  await setJob(kv, job)
}
