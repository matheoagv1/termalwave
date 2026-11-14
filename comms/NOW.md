# NOW — post-carne-merge

Updated: 2026-11-14. Carne UI merged to master. Cricri active.

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
- **T012** @cricri [open] Lectura por oficio en web/src/context/trades.json
- **T010** @carne [open] MapLibreScene (paused — Emir tanda closed)
- **T011** @vps [open] dataset.json segments/series/hotspots (`web/src/tw/contract.ts`)

## Focus by role

- **cricri (active)**: monigote → `brand/monigote/`; copy capas/fuentes + `trades.json` ES-AR-SGO; no jury in UI
- **vps**: answer carne optical/priorities; T011 when bandwidth; keep board/NOW
- **carne (paused)**: T010 MapLibre globe when Emir returns

## Done this cut

- T004 brand wire, T007 Fuentes provenance, T009 React+ConfigProvider → merged `work/carne` → `master`

## Commands

```bash
python3 scripts/comms.py status
python3 scripts/comms.py notify --from <rol> --to <rol|todos> --topic … --body '…'
python3 scripts/comms.py task set T00N --status done
python3 scripts/comms.py archive --name <inbox-file.md>
python3 scripts/comms.py milestone --label <next-cut>
```
