# NOW — deploy ready

Updated: 2026-11-14. PC1+PC2 mergeados; preview redeployed.

## Read this turn

1. This file
2. `comms/board.toml` (open only)
3. New inbox → archive

## Live

- GitHub: https://github.com/matheoagv1/termalwave (private)
- Preview: https://termalwave-preview.vroms.workers.dev

## Open

- **T011** @vps dataset.json (series/hotspots; UI ya adapta app-config)

## Just closed

- T008/T012 cricri context
- Carne HUD collapsible merged

## Roles

- **PC1 cricri**: merge master; clean inbox; next polish copy if needed
- **PC2 carne**: merge master; archive observer-sftp note; wire monigote if ready
- **vps**: T011 + keep preview green

## Commands

```bash
python3 scripts/comms.py status
git merge master
```
