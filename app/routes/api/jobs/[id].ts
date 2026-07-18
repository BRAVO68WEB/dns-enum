import { createRoute } from 'honox/factory'
import { getJob } from '../../../lib/cache'

export const GET = createRoute(async (c) => {
  const jobId = c.req.param('id') ?? ''
  if (!jobId) return c.json({ error: 'Missing job ID' }, 400)
  const job = await getJob(c.env.CACHE_KV, jobId)

  if (!job) {
    return c.json({ error: 'Job not found' }, 404)
  }

  return c.json({
    id: job.id,
    domain: job.domain,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  })
})
