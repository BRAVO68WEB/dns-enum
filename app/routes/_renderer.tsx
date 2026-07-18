import { jsxRenderer, useRequestContext } from 'hono/jsx-renderer'
import { Link, Script } from 'honox/server'
import { getCookie } from 'hono/cookie'

export default jsxRenderer(({ children }) => {
  const c = useRequestContext()
  const token = getCookie(c, 'session')

  let user: { login?: string; avatar?: string } | null = null
  if (token) {
    try {
      const parts = token.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        user = { login: payload.login, avatar: payload.avatar }
      }
    } catch {}
  }

  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>DNS Enum</title>
        <link rel="icon" href="/favicon.ico" />
        <Link href="/app/style.css" rel="stylesheet" />
        <Script src="/app/client.ts" async />
      </head>
      <body class="bg-gray-950 text-white min-h-screen">
        <nav class="px-6 py-4 flex items-center justify-between">
          <a href="/" class="font-bold text-lg">DNS Enum</a>
          <div class="flex items-center gap-4">
            {user ? (
              <a href="/auth/logout" class="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                <img src={user.avatar} alt={user.login} class="w-8 h-8 rounded-full" />
                <span>{user.login}</span>
              </a>
            ) : (
              <a href="/auth/github" class="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors border border-gray-700">Sign in</a>
            )}
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
})
