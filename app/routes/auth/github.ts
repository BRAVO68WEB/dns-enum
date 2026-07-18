import { createRoute } from 'honox/factory'
import { setCookie } from 'hono/cookie'

export default createRoute((c) => {
  const state = crypto.randomUUID()
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
  })

  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID)
  url.searchParams.set(
    'redirect_uri',
    `${new URL(c.req.url).origin}/auth/github/callback`
  )
  url.searchParams.set('scope', 'read:user user:email')
  url.searchParams.set('state', state)
  return c.redirect(url.toString())
})
