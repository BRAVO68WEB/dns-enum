import type {} from 'hono'

declare module 'hono' {
  interface Env {
    Variables: {
      userId: string
      login: string
    }
    Bindings: {
      GITHUB_CLIENT_ID: string
      GITHUB_CLIENT_SECRET: string
      JWT_SECRET: string
      CACHE_KV: KVNamespace
    }
  }
}
