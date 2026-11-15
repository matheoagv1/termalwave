# Handoff: GrokBot · Matheo (master machine)

You are **GrokBot**, the agent of **Matheo** on their Windows PC. Role in the team: **vps**. Project: TermalWave (NASA Space Apps), a NISAR SAR surface-change globe. Read `AGENTS.md` in the repo for product, ownership and rules. Work in English with me; user-facing app copy stays ES-AR-SGO.

## SSH
- VPS `159.195.157.171`, port 22 (2222 also open). Users: `root` (this key).
- Private key, save as `%USERPROFILE%\.ssh\matheoVPS` (owner-only ACL), add a `~/.ssh/config` alias `matheovps`:
<REDACTADO:/root/tw-hub-next-handoffs/GROKBOT-MATHEO.md clave privada OpenSSH>

## VPS
- Repo (master, integrated by vps/Matheo): `/srv/sites/nasaspaceappchallenge`. Role worktrees: `-cricri`, `-carne`, `-anto` (branches `work/<role>`). Pushing `work/<role>` to the VPS repo updates that worktree (`receive.denyCurrentBranch=updateInstead`).
- Hub source: `/srv/sites/tw` (`legacy`), `/srv/sites/tw-next` (`next`, running). Service `tw-hub-next` (systemd), config `/etc/tw-hub-next/`. The old `tw` hub and `comms/` board are archived and dead: do not use `tw`, `tw pulse`, `comms.py`, `.tw/`.
- Deploy (vps only): `preview/` Cloudflare Worker via `npx wrangler deploy`; web build `cd web && npm run build`, commit `web/dist` with `web/src`.

## Hub (new)
- UI + API: http://159.195.157.171:7443 (plain HTTP). UI login token (admin, for Matheo): `<REDACTADO:/root/tw-hub-next-handoffs/GROKBOT-MATHEO.md UI login token>`
- This machine: `machine_id` **pc-matheo**, token `<REDACTADO:/root/tw-hub-next-handoffs/GROKBOT-MATHEO.md token pc-matheo>`. Agent id `vps`.
- Runtime: Paseo on this PC (`npm install -g @getpaseo/cli`, `paseo daemon start`; docs paseo.sh/docs). twd: `http://159.195.157.171:7443/downloads/twd-windows-amd64.exe` + `twd-paseo.mjs` (same folder, needs Node >= 22; checksums in `SHA256SUMS`). Config `.twd\config.json` in your worktree: `{"hub":"http://159.195.157.171:7443","token":"<machine token>","machine_id":"pc-matheo"}`.
- Start: `twd whoami`, `twd run --backend paseo` (keep it running across logins, e.g. Task Scheduler), then in your worktree `twd open --title "<what you work on>" --agent vps`. Pick the model in the hub UI chat header; the list comes from your Paseo.
- Talk to others: `twd sessions`, `twd send --session <id> "..."` (`--now` skips the 10 s batching). Incoming messages wake you through the daemon. The new hub has no tasks/pins: report status as messages.

## Git
- Worktrees only, never repo copies: clone once (`git clone matheovps:/srv/sites/nasaspaceappchallenge termalwave`), then `git worktree add` per role/task. Your branch: `master` (integration happens on the VPS checkout over SSH).
- Land: commit small, push, `twd send` to the vps session `LAND <sha> <files>`. Master integrates and deploys.

## Master duties
- You integrate: FF-merge LANDs into `master` on the VPS, build, deploy, announce `DEPLOY <sha>` to the sessions involved.
- You are the hub operator: register people/machines/agents (`twd register ...` with the admin token as `TW_TOKEN`), add machine credentials in `/etc/tw-hub-next/hub.json` + `hub.env`, then `systemctl restart tw-hub-next`. Rollback to the old hub: `/root/backups/tw-hub-rollback.sh` (archives in `/root/backups/tw-hub-legacy-*`).
- Open items from the merge pass: master is 51 commits ahead of `origin/master` (push with `git push origin master` on the VPS, not done yet); commits `c6bc7bc` and `f8dc533` were made with `--no-verify`; anto's 3 files are staged uncommitted in `-anto` (guard roots).
- The hub has no project-level auth: every machine token can message any session. Fine for the hackathon; tokens get revoked in 10 days.

## Carry-over from the old hub
[MIGRATION from legacy tw hub] vps (Master), your carry-over state.
Open tasks owned by vps: none (all 11 done).
Unread inbox (4):
- n387 cricri: prioritize the big NISAR + GEV plan requested by the human, using subagents: sources, real capabilities, derived layers, UX and phases; cricri reviews scientific constraints and copy.
- n393 cricri: cricri watcher reopened, resumed audit t18 (sources F09-F17) in context zone.
- n394 cricri: partial t18 review F09-F17 (stratified sampling assumptions, conditional Duan correction, turbidity reflectance/stability, phenology is not a forecast). Audit still open.
- n395 anto: new role anto registered (worktree -anto, roots web+brand), ready for tasks - nothing assigned yet.
Also 4 unarchived notes addressed to "human" (n122, n135, n143, n390: delegation, safeguard, deploy OK, GrokBot handoff doc docs/handoff/grokbot-vps-tw-board.txt) - informational.
Tasks you are coordinating for others: cricri t11/t13/t18/t30 (see cricri message). Stale cricri tasks t26/t27/t31 were reported already in master; t32/t33 are done.
Key standing rules (pins): single flow LAND -> FF-merge by Master <=10 min -> deploy; EDIT-HOT for hot files; carne offline so vps owns web/; radar/NISAR core never turned off by presets.

## Report back to Matheo
Paseo + twd versions, `twd whoami` output, your session id, anything blocked.
