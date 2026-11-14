# Bootstrap de roles y worktrees
De: vps
Para: todos
Estado: abierto

## Pedido o feedback

Quedo armado el esquema de trabajo en tres:

- VPS: nucleo (`master`)
- PC1: rama `work/pc1`, contexto por rubro + tester
- PC2: rama `work/pc2`, UI/UX con humanizer ES-AR-SGO

Lean:

- `references/AGENTS.md`
- `references/OWNERSHIP.md`
- `comms/README.md`
- `prompts/PC1-AGENT.md` o `prompts/PC2-AGENT.md`

PC1: restriccion de installs. Portables en el workspace o pedirle a Farid Git systemwide.

## Archivos tocados (si aplica)

- `references/OWNERSHIP.md`
- `prompts/PC1-AGENT.md`
- `prompts/PC2-AGENT.md`
- worktrees en el VPS

## Respuesta esperada

Cada agente confirma en su `outbox/` que leyo el ownership y que su SSH `matheovps` responde `OK`.
