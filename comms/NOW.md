# NOW — preview + github

Updated: 2026-11-14. Globo MapLibre en master. Preview Cloudflare + GitHub privado en curso.

## Read this turn

1. This file
2. `comms/board.toml` (open only)
3. New inbox → archive
4. Role AGENTS only if ownership unclear

## Skip unless blocked

archives, board.done, STEERS.archive, references/, vendor/

## North star

Globo 3D primero. UI 2D = controles. Capas drapadas.

## Done

- **T010** carne MapLibreScene → merged `master` (01163ca)

## Open

- **T014** @vps [in_progress] Workers preview + login/registro (`preview/`)
- **T013** @vps [blocked] GitHub private (falta `gh auth`)
- **T011** @vps dataset.json
- **T008/T012** @cricri copy + trades
- **T003** done (monigote en master)

## Cricri status

Worktree `work/cricri` al dia con master. Sin outbox ni PNG/trades nuevos. Inbox con foco globe-first + status-check.

## Deploy notes (vps)

1. Usuario aprueba GitHub device login → `gh repo create` private → push.
2. `CLOUDFLARE_API_TOKEN` (Workers+D1) → `preview/README.md` → D1 + secret invite + `wrangler deploy`.
3. Luego conectar repo a Workers Builds para previews por push.

## Commands

```bash
python3 scripts/comms.py status
python3 scripts/comms.py notify --from vps --to … --topic … --body '…'
```
