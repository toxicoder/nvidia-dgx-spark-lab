[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/auth](../README.md) / auth

# Variable: auth

> `const` **auth**: `Auth`\<\{ `baseURL`: `string`; `database`: (`options`) => `DBAdapter`\<`BetterAuthOptions`\>; `emailAndPassword`: \{ `enabled`: `true`; \}; `plugins`: \[\{ \}\]; `secret`: `string`; \}\>

Defined in: [lib/auth.ts:21](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/auth.ts#L21)

Server-side Better Auth instance backed by Drizzle + SQLite.

Environment:
- `BETTER_AUTH_SECRET` — session signing key (required in production)
- `BETTER_AUTH_URL` — public base URL (NodePort or ingress)

Test/dev bypass: set `AUTH_BYPASS=1` or `USE_MOCKS=1` in middleware instead of weakening this config.
