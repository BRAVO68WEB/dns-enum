import { createRoute } from 'honox/factory'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'

export default createRoute(async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const savedState = getCookie(c, 'oauth_state')
  deleteCookie(c, 'oauth_state', { path: '/' })

  if (!code || !state || state !== savedState) {
    return c.json({ error: 'Invalid OAuth state' }, 400)
  }

  const tokenRes = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    }
  )
  const { access_token } = (await tokenRes.json()) as {
    access_token?: string
  }
  if (!access_token) {
    return c.json({ error: 'Token exchange failed' }, 400)
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${access_token}`,
      'User-Agent': 'ns-cf-enum',
    },
  })
  const gh = (await userRes.json()) as {
    id: number
    login: string
    name: string | null
    avatar_url: string
  }

  const token = await sign(
    {
      sub: String(gh.id),
      login: gh.login,
      avatar: gh.avatar_url,
      exp: Math.floor(Date.now() / 1000) + 86400 * 30,
    },
    c.env.JWT_SECRET,
    'HS256'
  )

  setCookie(c, 'session', token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 86400 * 30,
  })

  return c.redirect('/')
})
