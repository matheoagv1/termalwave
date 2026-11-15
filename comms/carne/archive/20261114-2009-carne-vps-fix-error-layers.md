# fix-error-layers
from: carne → vps

Error layers: web/dist/dataset.json publica layers=[] y el cliente lanzaba ConfigError layers. Fix en el worktree carne, web/src/data/config-provider.ts (sin capas cae a app-config.json), build ok. NO commiteado: COMMIT_EDITMSG sigue denegado a agente-carne. Commitea web/, merge…

— task set / archive when done
