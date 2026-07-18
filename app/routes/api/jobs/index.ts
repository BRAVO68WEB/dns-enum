import { createRoute } from 'honox/factory'
import { getCookie, setCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import { isValidDomain } from '../../../lib/dns'
import { setJob, getCachedResult, cacheResult, getJob, type JobState } from '../../../lib/cache'
import { nanoid } from '../../../lib/nanoid'

const ANON_CACHED_LIMIT = 2
const VISITOR_COOKIE = 'visitor_id'
const SEARCH_COOKIE = 'search_count'

function getVisitorId(c: any): string | null {
  return getCookie(c, VISITOR_COOKIE) || null
}

function getSearchCount(c: any): number {
  return parseInt(getCookie(c, SEARCH_COOKIE) || '0', 10)
}

function incrementSearchCount(c: any): void {
  const count = getSearchCount(c) + 1
  setCookie(c, SEARCH_COOKIE, String(count), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 86400 * 30,
  })
}

function isAuthenticated(c: any): boolean {
  const token = getCookie(c, 'session')
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1]))
    return !!payload.sub
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

  const visitorId = getVisitorId(c)
  if (!visitorId) {
    return c.json({ error: 'invalid_request', message: 'Visit the website first to get a session' }, 400)
  }

  const authed = isAuthenticated(c)
  const searchCount = getSearchCount(c)

  // Cached result path
  if (!force) {
    const cached = await getCachedResult(c.env.CACHE_KV, domain)
    if (cached) {
      if (!authed && searchCount >= ANON_CACHED_LIMIT) {
        return c.json({
          error: 'auth_required',
          message: 'Sign in to search more domains',
          visitorId,
          searchCount,
        }, 401)
      }
      incrementSearchCount(c)
      return c.json({
        id: `cached-${domain}`,
        domain,
        status: 'complete',
        result: cached,
        fromCache: true,
        searchCount: searchCount + 1,
      })
    }
  }

  // New search always requires auth
  if (!authed) {
    return c.json({
      error: 'auth_required',
      message: 'Sign in to search new domains',
      visitorId,
      searchCount,
    }, 401)
  }

  // Authenticated user creating new job
  incrementSearchCount(c)

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
