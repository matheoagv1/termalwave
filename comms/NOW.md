# NOW — PC agents free run + preview fixed

Updated: 2026-11-14.

## Live

- Preview: https://termalwave-preview.vroms.workers.dev
- Invite registro: `ksEyXTkWrFR_f0_L`
- GitHub: https://github.com/matheoagv1/termalwave

## Auth fix

Worker 1101 era cookie sobre `Response.redirect` inmutable. Ya redeployed.

## Open board

- **T015/T017** @carne — monigote + pulir UI; commit/push
- **T018/T019** @cricri — testear preview + copy; VPS no verifica
- **T011** @vps — dataset.json (no bloquea)

## Board poll loop (PC1 + PC2)

Cuando terminan una tanda:

```bash
python3 scripts/board_poll_loop.py --role carne   # PC2
python3 scripts/board_poll_loop.py --role cricri  # PC1
```

Cada 5 min mira board+inbox. Sale solo tras **4** intervalos idle seguidos.

## Roles

- **PC1 cricri**: test + copy. No pidas verify al VPS.
- **PC2 carne**: UI polish + monigote + commits.
- **vps**: merge/deploy/T011; board fresco.
