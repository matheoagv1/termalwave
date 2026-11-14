# NOW — post-carne-merge

Updated: 2026-11-14 (UTC date). Hackathon: vibecode lean.

## Read this turn (and almost nothing else)

1. This file (`comms/NOW.md`)
2. `comms/board.toml` (open tasks only)
3. New files in your `comms/<rol>/inbox/` (then archive them)
4. `agents/<rol>/AGENTS.md` only if ownership is unclear

## Do not open unless blocked

- `comms/**/archive/`, `comms/board.done.toml`, `comms/STEERS.archive.md`
- `references/`, `vendor/`, old prompts history, brand binaries
- Full `AGENTS.md` jury tables (product rules already known)

## Open tasks

- **T003** @cricri [open] Deposit monigote PNG in brand/monigote/
- **T008** @cricri [open] Context copy for data sources / layers (no jury in UI)
- **T010** @carne [open] MapLibreScene (globo + territorio + cortina) detras de SceneApi
- **T011** @vps [open] dataset.json con tramos (segments), series y hotspots segun web/src/tw/contract.ts
- **T012** @cricri [open] Lectura por oficio en web/src/context/trades.json

## Focus by role

- **vps**: pipeline/providers/config/data; keep board/NOW fresh; merge master
- **carne**: React `web/` UX, brand wire, Fuentes panel from `provenance`
- **cricri**: `brand/monigote/`, `web/src/context/`, gusto notes via notify

## Commands

```bash
python3 scripts/comms.py status
python3 scripts/comms.py notify --from <rol> --to <rol|todos> --topic … --body '…'
python3 scripts/comms.py task set T00N --status done
python3 scripts/comms.py archive --name <inbox-file.md>
python3 scripts/comms.py milestone --label <next-cut>
```
