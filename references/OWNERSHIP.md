# Ownership del equipo (3 personas)

Hay tres roles. Cada uno trabaja en su rama / worktree. No pisar el arbol del otro.

## Roles

| Rol | Maquina | Rama | Worktree |
|---|---|---|---|
| VPS | Servidor (`159.195.157.171`) | `master` | `/srv/sites/nasaspaceappchallenge` |
| PC1 | Windows (Codex workspace) | `work/pc1` | `/srv/sites/nasaspaceappchallenge-pc1` |
| PC2 | Windows | `work/pc2` | `/srv/sites/nasaspaceappchallenge-pc2` |

## Que puede tocar cada uno

### VPS (nucleo / portable / datos)

Puede editar:

- `termalwave/`
- `vendor/` (solo via `scripts/vendor.sh`)
- `scripts/`
- `tests/`
- `config/runtime.json`
- `config/*.toml` (AOI / datos; avisar en comms si cambia bounds)
- `data/`
- `docs/ARCHITECTURE.md`
- `references/` (contexto IA, challenge, ownership)
- `comms/from-vps/`
- `comms/pc1/inbox/` y `comms/pc2/inbox/` (notificaciones)

No debe editar salvo acuerdo explicito:

- `web/src/` UI visual / flujo (PC2)
- copy de interfaz orientada a rubros (PC1)

### PC1 (contexto por rubro + tester de gusto)

Puede editar:

- `web/src/context/` (si no existe, crearlo) para textos/capas/briefings por oficio
- `web/src/content/` si hace falta material de dominio
- `comms/pc1/outbox/` (feedback de gusto, hallazgos de test)
- `comms/pc2/inbox/` (feedback concreto para UX)
- `comms/from-vps/` solo lectura

No puede editar:

- `termalwave/`, `vendor/`, `scripts/vendor.sh`, `tests/` de portable
- `config/runtime.json`
- rediseño amplio de flujo UX (eso es PC2; PC1 opina, no reescribe el flujo entero)

Rol de tester: decir que esta bien de gusto y que no, con ejemplos concretos y rutas de archivo. Sin adulacion vacia.

Restriccion de esta maquina: **no puede instalar nada fuera del workspace de Codex**. Usar binarios portables dentro del workspace, o pedir a Farid instalacion systemwide (git, etc.).

### PC2 (UI / UX / flujo)

Puede editar:

- `web/` (fuente Vite, estilos, mapa, flujo, animaciones)
- `comms/pc2/outbox/`
- leer `comms/pc1/outbox/` y `comms/from-vps/` como feedback obligatorio

No puede editar:

- `termalwave/`, `vendor/`, `scripts/` de vendor/portable
- `config/runtime.json` (salvo que VPS pida un cambio de campo web en el TOML)

Todo string visible: humanizer **ES-AR-SGO**. Nada de slop de IA.

## Integracion

1. Cada uno commitea en su rama.
2. VPS integra a `master` cuando el cambio esta listo (merge/rebase).
3. Conflictos en `web/`: PC2 manda en flujo/estructura; PC1 manda en contenido de rubros bajo `web/src/context/`.
