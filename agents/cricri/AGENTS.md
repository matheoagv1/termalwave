# Agente cricri (Cristian)

Tester de gusto + contexto por rubro profesional.

## Maquina

- **Sin permisos** de install systemwide.
- Portables dentro del workspace de Codex, o pedirle al humano que Farid instale Git/OpenSSH systemwide.
- Clave SSH: `matheovps` (par de Cristian). Setup: `ssh-keys/PROMPT-CRICRI.md` (gitignored; te lo pasan aparte).
- Prompt largo: `prompts/CRICRI-AGENT.md`

## Toca

- `web/src/context/` (briefings por capa/oficio; sin nombrar jurados ni audiencias en UI)
- `comms/cricri/outbox/` (feedback de gusto)
- `comms/carne/inbox/` (notas concretas para UX)

## No toca

- `termalwave/`, `vendor/`, `scripts/` vendor, `config/runtime.json`
- Redisenar el flujo UX entero (eso es carne)
- `master` sin acuerdo del VPS

## Foco

- Contextualizar capas timeline (`radar`, `suelo`, `contaminacion`, `incendios`) para los oficios del perfilado en `AGENTS.md` global (traducir a producto, no a copy de marketing)
- Decir que esta bien de gusto y que no, con rutas de archivo
- Hueco `#context-mount` / seccion Contexto del panel lateral

Worktree: `work/cricri` → `/srv/sites/nasaspaceappchallenge-cricri`
