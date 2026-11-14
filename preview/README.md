# TermalWave preview (Cloudflare Workers)

Sirve `web/dist` detras de login/registro. Mientras el producto no es publico, el registro pide `PREVIEW_INVITE_CODE`.

## Una vez

```bash
# en la maquina VPS, con Cloudflare autenticado
export CLOUDFLARE_ACCOUNT_ID=4b7daf5afb33823aa3d60df69cd6eaa6
export CLOUDFLARE_API_TOKEN=…   # Account token: Workers Edit + D1 Edit

cd preview
npx wrangler d1 create termalwave-preview-auth
# pegar database_id en wrangler.jsonc

npx wrangler d1 execute termalwave-preview-auth --remote --file=./schema.sql
npx wrangler secret put PREVIEW_INVITE_CODE
npx wrangler deploy
```

GitHub privado + Workers Builds: conectar el repo, build `cd web && npm ci && npm run build`, deploy command `cd preview && npx wrangler deploy`, root `preview/`.

## Auth

- `/auth` login y registro
- Cookie `tw_preview` HttpOnly Secure SameSite=Lax
- PBKDF2-SHA256 100k iters + salt
- Sin invite code en el Worker = registro cerrado si falta el secret (pone el secret)
