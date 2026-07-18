import { createRoute } from 'honox/factory'
import { deleteCookie } from 'hono/cookie'

export default createRoute((c) => {
  deleteCookie(c, 'session', { path: '/' })
  return c.redirect('/')
})
