# Coordinacion — harness compartido

Un canal. Un `comms/` vivo en el VPS (master). Worktrees **symlink** + `link-worktrees` copia scripts/hooks/rules para que no driften.

## Arranque (lean)

1. Hook briefing, o `python3 scripts/comms.py pulse`
2. Si hay trabajo: [`NOW.md`](NOW.md) + tu task (`paths` si hay)
3. Inbox nuevo → archive
4. Editá solo `own/` (`seat`) o `task.paths`

**Idle / standby:** no explores. Volvé a `pulse`.

No leas `archive/`, `board.done.toml`, `STEERS.archive.md`, `milestones/` en turnos normales.

## CLI

```bash
python3 scripts/comms.py pulse
python3 scripts/comms.py seat
python3 scripts/comms.py check
python3 scripts/comms.py status          # solo tuyas
python3 scripts/comms.py status --all
python3 scripts/comms.py now --label live
python3 scripts/comms.py task add --owner carne --title "…" --paths "web/src/…"
python3 scripts/comms.py task set T004 --status in_progress --paths "web/…"
python3 scripts/comms.py notify --from vps --to cricri --topic x --body "corta"
python3 scripts/comms.py archive --name 20261114-….md
python3 scripts/comms.py milestone --label cut
python3 scripts/comms.py link-worktrees
```

`notify` ≤280 chars (clip silencioso en la misma linea). Sin secretos en `comms/`.

## Roles

| Rol | Humano | Edit roots (`seat`) |
|---|---|---|
| `vps` | Farid/Matheo | `termalwave/` `scripts/` `config/` … |
| `carne` | Emir | `web/` `brand/` |
| `cricri` | Cristian | `web/src/context/` `brand/monigote/` |

## Delegar

1. `task add` / `task set` (+ `--paths` cuando se pueda)
2. `notify` corto
3. Al cerrar: `task set … done` + `archive`
