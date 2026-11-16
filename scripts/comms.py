#!/usr/bin/env python3
"""TermalWave shared agent harness (board + notify + lean briefing).

One live `comms/` tree on the VPS (master). Carne/cricri worktrees symlink to it
so board/inbox never drift. Prefer this CLI over reading archives or inventing
context.

Usage:
  python3 scripts/comms.py whoami|seat|check|pulse|now
  python3 scripts/comms.py status [--all]
  python3 scripts/comms.py briefing [--role ROLE]
  python3 scripts/comms.py task list|add|set … [--paths a,b]
  python3 scripts/comms.py notify --from ROLE --to ROLE|todos --topic slug --body "…"
  python3 scripts/comms.py archive --name FILENAME
  python3 scripts/comms.py milestone --label cut
  python3 scripts/comms.py link-worktrees   # symlink comms/ + sync harness files
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path


ROLES = ("vps", "carne", "cricri")
STATUSES = ("open", "in_progress", "blocked", "done", "cancelled")
OPENISH = ("open", "in_progress", "blocked")
NOTIFY_BODY_MAX = 280
TITLE_BRIEF_MAX = 56
NOW_OPEN_MAX = 8
# dirs each role may edit (agents stay inside these unless task.paths set)
ROLE_OWN = {
    "vps": "termalwave/ scripts/ config/ tests/ data/ vendor/ preview/ brand/ docs/",
    "carne": "web/ brand/",
    "cricri": "web/src/context/ brand/monigote/",
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def primary_root() -> Path:
    """Canonical VPS clone that owns the live board."""
    env = os.environ.get("TW_PRIMARY_ROOT", "").strip()
    if env:
        return Path(env).resolve()
    here = repo_root()
    name = here.name
    for suffix in ("-carne", "-cricri"):
        if name.endswith(suffix):
            candidate = here.parent / name[: -len(suffix)]
            if (candidate / "comms").exists():
                return candidate.resolve()
    return here.resolve()


def sibling_roots() -> list[Path]:
    primary = primary_root()
    parent = primary.parent
    base = primary.name
    out: list[Path] = []
    for path in (primary, parent / f"{base}-carne", parent / f"{base}-cricri"):
        if path.is_dir():
            out.append(path.resolve())
    # de-dupe
    seen: set[Path] = set()
    uniq: list[Path] = []
    for path in out:
        if path not in seen:
            seen.add(path)
            uniq.append(path)
    return uniq


def comms_root() -> Path:
    env = os.environ.get("TW_COMMS_ROOT", "").strip()
    if env:
        return Path(env).resolve()
    return (primary_root() / "comms").resolve()


def detect_role(cwd: Path | None = None) -> str:
    env = os.environ.get("TW_AGENT_ROLE", "").strip()
    if env in ROLES:
        return env
    path = str((cwd or Path.cwd()).resolve())
    if path.rstrip("/").endswith("-cricri") or "/nasaspaceappchallenge-cricri" in path:
        return "cricri"
    if path.rstrip("/").endswith("-carne") or "/nasaspaceappchallenge-carne" in path:
        return "carne"
    return "vps"


def board_path() -> Path:
    return comms_root() / "board.toml"


def steers_path() -> Path:
    return comms_root() / "STEERS.md"


def now_path() -> Path:
    return comms_root() / "NOW.md"


def board_done_path() -> Path:
    return comms_root() / "board.done.toml"


def steers_archive_path() -> Path:
    return comms_root() / "STEERS.archive.md"


def role_dirs(role: str) -> dict[str, Path]:
    base = comms_root() / role
    return {
        "inbox": base / "inbox",
        "outbox": base / "outbox",
        "archive": base / "archive",
    }


def load_board() -> list[dict]:
    path = board_path()
    if not path.is_file():
        return []
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    return list(data.get("task", []))


def write_board(tasks: list[dict]) -> None:
    lines = [
        "# Shared task board. Agents + steers update via: python3 scripts/comms.py task …",
        "# status: open | in_progress | blocked | done | cancelled",
        "# paths: optional edit allow-list (globs/dirs). Live comms/ via link-worktrees.",
        "",
    ]
    for task in tasks:
        lines.append("[[task]]")
        for key in (
            "id",
            "owner",
            "status",
            "title",
            "notes",
            "paths",
            "blocked_by",
            "updated",
        ):
            if key not in task or task[key] in (None, "", []):
                continue
            val = task[key]
            if key in ("blocked_by", "paths"):
                inner = ", ".join(f'"{x}"' for x in val)
                lines.append(f"{key} = [{inner}]")
            elif isinstance(val, str):
                esc = val.replace("\\", "\\\\").replace('"', '\\"')
                lines.append(f'{key} = "{esc}"')
            else:
                lines.append(f"{key} = {val}")
        lines.append("")
    board_path().write_text("\n".join(lines), encoding="utf-8")


def next_task_id(tasks: list[dict]) -> str:
    nums = []
    for task in tasks:
        match = re.fullmatch(r"T(\d+)", str(task.get("id", "")))
        if match:
            nums.append(int(match.group(1)))
    return f"T{max(nums, default=0) + 1:03d}"


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")


def list_md(dir_path: Path) -> list[Path]:
    if not dir_path.is_dir():
        return []
    return sorted(
        p for p in dir_path.iterdir() if p.is_file() and p.suffix == ".md" and p.name != ".gitkeep"
    )


def clip(text: str, n: int) -> str:
    text = " ".join(text.split())
    if len(text) <= n:
        return text
    return text[: max(0, n - 1)].rstrip() + "…"


def parse_paths(raw: str) -> list[str]:
    return [p.strip() for p in raw.replace(";", ",").split(",") if p.strip()]


def task_paths(task: dict) -> list[str]:
    raw = task.get("paths") or []
    if isinstance(raw, str):
        return parse_paths(raw)
    return [str(x).strip() for x in raw if str(x).strip()]


def is_waiter(task: dict) -> bool:
    """Standby/blocked tasks must not keep agents exploring."""
    if task.get("status") == "blocked":
        return True
    blob = f"{task.get('title') or ''} {task.get('notes') or ''}".lower()
    return "standby" in blob


def open_tasks_for(role: str | None = None) -> list[dict]:
    tasks = [t for t in load_board() if t.get("status") in OPENISH]
    if role:
        return [t for t in tasks if t.get("owner") == role]
    return tasks


def comms_linked_ok(here: Path | None = None) -> bool:
    root = (here or Path.cwd()).resolve()
    live = comms_root()
    local = root / "comms"
    try:
        if local.resolve() == live:
            return True
    except OSError:
        return False
    return False


def seat_line(role: str | None = None) -> str:
    role = role or detect_role()
    here = Path.cwd().resolve()
    branch = "?"
    try:
        proc = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=str(here),
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        branch = (proc.stdout or "").strip() or "?"
    except (OSError, subprocess.TimeoutExpired):
        branch = "?"
    link = "ok" if comms_linked_ok(here) or here == primary_root() else "DRIFT"
    return f"{role}@{here.name} branch={branch} comms={link} own={ROLE_OWN.get(role, '?')}"


def cmd_whoami(_: argparse.Namespace) -> int:
    print(detect_role())
    return 0


def cmd_seat(args: argparse.Namespace) -> int:
    role = args.role or detect_role()
    print(seat_line(role))
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    """One-line harness health. Non-zero if drift."""
    role = args.role or detect_role()
    primary = primary_root()
    live = comms_root()
    issues: list[str] = []
    if not live.is_dir():
        issues.append("no_comms")
    if not board_path().is_file():
        issues.append("no_board")
    here = Path.cwd().resolve()
    if here != primary and not comms_linked_ok(here):
        issues.append("comms_drift")
    # sibling scripts must match primary (quiet drift check)
    src = primary / "scripts" / "comms.py"
    if src.is_file():
        for root in sibling_roots():
            if root == primary.resolve():
                continue
            dest = root / "scripts" / "comms.py"
            if dest.is_file() and dest.read_bytes() != src.read_bytes():
                issues.append(f"scripts_drift:{root.name}")
    if issues:
        print(f"FAIL {role} " + ",".join(issues))
        return 1
    print(f"ok {seat_line(role)}")
    return 0


def pulse_line(role: str) -> str:
    mine = open_tasks_for(role)
    inbox = list_md(role_dirs(role)["inbox"])
    active = [t for t in mine if not is_waiter(t)]
    waiting = [t for t in mine if is_waiter(t)]
    if not active and not inbox:
        if waiting:
            ids = ",".join(str(t["id"]) for t in waiting)
            return f"{role}: standby {ids} — wait; do not explore"
        return f"{role}: idle — wait; do not explore"
    parts = [f"{role}:"]
    if active:
        parts.append(
            "tasks " + ",".join(f"{t['id']}[{t['status']}]" for t in active)
        )
    elif waiting:
        parts.append("standby " + ",".join(str(t["id"]) for t in waiting))
    if inbox:
        parts.append(f"inbox {len(inbox)}")
    return " ".join(parts)


def cmd_pulse(args: argparse.Namespace) -> int:
    role = args.role or detect_role()
    print(pulse_line(role))
    return 0


def _print_task(task: dict, *, with_owner: bool = False) -> None:
    own = f"@{task['owner']} " if with_owner else ""
    line = f"{task['id']} {own}[{task['status']}] {clip(str(task['title']), TITLE_BRIEF_MAX)}"
    paths = task_paths(task)
    if paths:
        line += " | " + ",".join(paths[:4])
        if len(paths) > 4:
            line += f"+{len(paths) - 4}"
    print(line)


def cmd_status(args: argparse.Namespace) -> int:
    role = args.role or detect_role()
    mine = open_tasks_for(role)
    print(f"role={role} {seat_line(role)}")
    print("--- yours ---")
    if not mine:
        print("(none)")
    for task in mine:
        _print_task(task)
    if args.all:
        openish = open_tasks_for()
        others = [t for t in openish if t.get("owner") != role]
        print(f"--- others ({len(others)}) ---")
        for task in others[:NOW_OPEN_MAX]:
            _print_task(task, with_owner=True)
        if len(others) > NOW_OPEN_MAX:
            print(f"+{len(others) - NOW_OPEN_MAX}")
    else:
        n = len(open_tasks_for())
        print(f"--- board: {n} open (status --all) ---")
    inbox = list_md(role_dirs(role)["inbox"])
    print(f"--- inbox ({len(inbox)}) ---")
    for path in inbox[:5]:
        print(path.name)
    if len(inbox) > 5:
        print(f"+{len(inbox) - 5}")
    return 0


def briefing_text(role: str) -> str:
    """Minimal hook payload. Idle/standby agents get a stop line only."""
    tasks = open_tasks_for(role)
    inbox = list_md(role_dirs(role)["inbox"])
    active = [t for t in tasks if not is_waiter(t)]
    waiting = [t for t in tasks if is_waiter(t)]
    if not active and not inbox:
        kind = "standby" if waiting else "idle"
        ids = ",".join(str(t["id"]) for t in waiting) if waiting else "-"
        return "\n".join(
            [
                f"[TermalWave] role={role} {kind} {ids}",
                "Do not browse. Wait for board/notify.",
                "Wake: python3 scripts/comms.py pulse",
            ]
        )
    lines = [
        f"[TermalWave] role={role}",
        seat_line(role),
        "NOW.md only. No archives/references/vendor.",
        "CLI: pulse|status|notify|task set|archive|check",
    ]
    if active:
        bits = []
        for t in active:
            bit = f"{t['id']}[{t['status']}] {clip(str(t['title']), TITLE_BRIEF_MAX)}"
            paths = task_paths(t)
            if paths:
                bit += " paths=" + ",".join(paths[:3])
            bits.append(bit)
        lines.append("Tasks: " + "; ".join(bits))
    elif waiting:
        lines.append("Standby: " + ",".join(str(t["id"]) for t in waiting))
    if inbox:
        lines.append("Inbox: " + ", ".join(p.name for p in inbox[:3]))
        if len(inbox) > 3:
            lines[-1] += f" +{len(inbox) - 3}"
    lines.append("End: task set + archive. Edit only own/ paths.")
    return "\n".join(lines)


def cmd_briefing(args: argparse.Namespace) -> int:
    role = args.role or detect_role()
    sys.stdout.write(briefing_text(role) + "\n")
    return 0


def cmd_task_list(args: argparse.Namespace) -> int:
    for task in load_board():
        if args.owner and task.get("owner") != args.owner:
            continue
        if args.status and task.get("status") != args.status:
            continue
        print(
            f"{task.get('id')}\t{task.get('owner')}\t{task.get('status')}\t"
            f"{clip(str(task.get('title') or ''), TITLE_BRIEF_MAX)}"
        )
    return 0


def cmd_task_add(args: argparse.Namespace) -> int:
    if args.owner not in ROLES:
        print(f"owner must be one of {ROLES}", file=sys.stderr)
        return 2
    tasks = load_board()
    task: dict = {
        "id": next_task_id(tasks),
        "owner": args.owner,
        "status": "open",
        "title": clip(args.title, 160),
        "updated": today(),
    }
    if args.blocked_by:
        task["blocked_by"] = [x.strip() for x in args.blocked_by.split(",") if x.strip()]
        task["status"] = "blocked"
    if args.notes:
        task["notes"] = clip(args.notes, NOTIFY_BODY_MAX)
    if args.paths:
        task["paths"] = parse_paths(args.paths)
    tasks.append(task)
    write_board(tasks)
    print(task["id"])
    return 0


def cmd_task_set(args: argparse.Namespace) -> int:
    if args.status not in STATUSES:
        print(f"bad status", file=sys.stderr)
        return 2
    tasks = load_board()
    found = False
    for task in tasks:
        if task.get("id") == args.id:
            task["status"] = args.status
            task["updated"] = today()
            if args.notes:
                task["notes"] = clip(args.notes, NOTIFY_BODY_MAX)
            if args.paths:
                task["paths"] = parse_paths(args.paths)
            found = True
            break
    if not found:
        print(f"unknown {args.id}", file=sys.stderr)
        return 2
    write_board(tasks)
    print(f"{args.id} -> {args.status}")
    return 0


def cmd_notify(args: argparse.Namespace) -> int:
    if args.from_role not in ROLES:
        print(f"bad --from", file=sys.stderr)
        return 2
    targets = list(ROLES) if args.to == "todos" else [args.to]
    for target in targets:
        if target not in ROLES:
            print(f"bad --to", file=sys.stderr)
            return 2
    topic = re.sub(r"[^a-z0-9-]+", "-", args.topic.lower()).strip("-") or "note"
    name = f"{stamp()}-{args.from_role}-{args.to if args.to != 'todos' else 'todos'}-{topic}.md"
    body = args.body.strip()
    truncated = False
    if len(body) > NOTIFY_BODY_MAX:
        body = body[: NOTIFY_BODY_MAX - 1].rstrip() + "…"
        truncated = True
    content = (
        f"# {topic}\n"
        f"from: {args.from_role} → {args.to}\n\n"
        f"{body}\n\n"
        f"— task set / archive when done\n"
    )
    outbox = role_dirs(args.from_role)["outbox"]
    outbox.mkdir(parents=True, exist_ok=True)
    out_path = outbox / name
    out_path.write_text(content, encoding="utf-8")
    written = [out_path]
    for target in targets:
        if target == args.from_role and args.to != "todos":
            continue
        inbox = role_dirs(target)["inbox"]
        inbox.mkdir(parents=True, exist_ok=True)
        dest = inbox / name
        dest.write_text(content, encoding="utf-8")
        written.append(dest)
    rels = " ".join(str(p.relative_to(comms_root().parent)) for p in written)
    # one stdout line; clip flag stays on the same line (no stderr noise)
    print(rels + (" clipped" if truncated else ""))
    return 0


def cmd_archive(args: argparse.Namespace) -> int:
    role = args.role or detect_role()
    dirs = role_dirs(role)
    src = dirs["inbox"] / args.name
    if not src.is_file():
        src = dirs["outbox"] / args.name
    if not src.is_file():
        print(f"not found: {args.name}", file=sys.stderr)
        return 2
    dirs["archive"].mkdir(parents=True, exist_ok=True)
    dest = dirs["archive"] / src.name
    dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    src.unlink()
    print(dest.relative_to(comms_root().parent))
    return 0


def _archive_file(src: Path, archive_dir: Path) -> Path | None:
    if not src.is_file() or src.name == ".gitkeep":
        return None
    archive_dir.mkdir(parents=True, exist_ok=True)
    dest = archive_dir / src.name
    if dest.exists():
        dest = archive_dir / f"{src.stem}-dup-{stamp()}{src.suffix}"
    dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    src.unlink()
    return dest


def write_now_md(label: str) -> Path:
    tasks = open_tasks_for()
    by_owner: dict[str, int] = {r: 0 for r in ROLES}
    for task in tasks:
        owner = str(task.get("owner") or "?")
        by_owner[owner] = by_owner.get(owner, 0) + 1
    counts = " ".join(f"{r}:{by_owner.get(r, 0)}" for r in ROLES)
    lines = [
        f"# NOW — {label}",
        "",
        f"Updated: {today()} UTC. One live `comms/` (symlink).",
        "",
        "Turn: `pulse` → NOW + your task → inbox archive → edit own/paths only.",
        "Idle/standby: stop. No archives/references/vendor.",
        "",
        f"## Open ({len(tasks)}) {counts}",
        "",
    ]
    if not tasks:
        lines.append("(none) — idle: wait")
    # prefer non-waiter + non-subagent noise; keep short
    ranked = sorted(
        tasks,
        key=lambda t: (is_waiter(t), str(t.get("owner")), str(t.get("id"))),
    )
    for task in ranked[:NOW_OPEN_MAX]:
        paths = task_paths(task)
        extra = f" `{paths[0]}`" if paths else ""
        lines.append(
            f"- **{task['id']}** @{task['owner']} [{task['status']}] "
            f"{clip(str(task['title']), TITLE_BRIEF_MAX)}{extra}"
        )
    if len(ranked) > NOW_OPEN_MAX:
        lines.append(f"- … +{len(ranked) - NOW_OPEN_MAX} more (`status --all`)")
    lines.extend(
        [
            "",
            "## Harness",
            "",
            "`pulse` · `seat` · `check` · `status` · `notify` (≤280) · `task set` · `link-worktrees`",
            "",
            "No secrets in comms.",
            "",
        ]
    )
    path = now_path()
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def cmd_now(args: argparse.Namespace) -> int:
    label = (args.label or "live").strip()
    path = write_now_md(label)
    print(path.relative_to(primary_root()))
    return 0


def cmd_milestone(args: argparse.Namespace) -> int:
    label = args.label.strip() or today()
    keep = set(args.keep or [])
    root = primary_root()
    milestones = comms_root() / "milestones"
    milestones.mkdir(parents=True, exist_ok=True)
    snap = milestones / f"{stamp()}-{label}.md"

    snap_lines = [
        f"# Milestone snapshot {label}",
        "",
        "## board.toml",
        "```toml",
        board_path().read_text(encoding="utf-8") if board_path().is_file() else "",
        "```",
        "",
    ]
    snap.write_text("\n".join(snap_lines), encoding="utf-8")

    archived = 0
    for role in ROLES:
        dirs = role_dirs(role)
        for bucket in ("inbox", "outbox"):
            for path in list_md(dirs[bucket]):
                if path.name in keep:
                    continue
                if _archive_file(path, dirs["archive"]):
                    archived += 1

    tasks = load_board()
    active = [t for t in tasks if t.get("status") not in ("done", "cancelled")]
    done = [t for t in tasks if t.get("status") in ("done", "cancelled")]
    if done:
        existing_done: list[dict] = []
        if board_done_path().is_file():
            existing_done = list(
                tomllib.loads(board_done_path().read_text(encoding="utf-8")).get("task", [])
            )
        seen = {t.get("id") for t in existing_done}
        for task in done:
            if task.get("id") not in seen:
                existing_done.append(task)
        # park done into board.done.toml, then restore active board
        write_board(existing_done)
        board_done_path().write_text(board_path().read_text(encoding="utf-8"), encoding="utf-8")
        write_board(active)

    if steers_path().is_file():
        prev = steers_path().read_text(encoding="utf-8")
        with steers_archive_path().open("a", encoding="utf-8") as fh:
            fh.write(f"\n\n---\n# archived at milestone {label} ({stamp()})\n\n")
            fh.write(prev)
        steers_path().write_text(
            "\n".join(
                [
                    "# Steers — current only",
                    "",
                    "Historial: `STEERS.archive.md` (no leer en turnos normales).",
                    "",
                    f"## {today()} — milestone `{label}`",
                    "",
                    "1. Shared harness: `scripts/comms.py` + one live `comms/`.",
                    "2. Idle → `pulse` only; no repo tourism.",
                    "3. Short notifies. Board is source of truth.",
                    "",
                    "No secrets in comms.",
                    "",
                ]
            ),
            encoding="utf-8",
        )

    now = write_now_md(label)
    print(
        f"milestone={label} archived={archived} active={len(active)} "
        f"parked={len(done)} {now.relative_to(root)}"
    )
    return 0


def _sync_file(src: Path, dest: Path) -> bool:
    if not src.is_file():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and dest.read_bytes() == src.read_bytes():
        return False
    shutil.copy2(src, dest)
    return True


def cmd_link_worktrees(_: argparse.Namespace) -> int:
    """Point sibling worktree comms/ at primary; sync harness scripts/hooks/rules."""
    primary = primary_root()
    live = (primary / "comms").resolve()
    if not live.is_dir():
        print(f"missing primary comms: {live}", file=sys.stderr)
        return 2
    linked = 0
    synced = 0
    for root in sibling_roots():
        if root == primary.resolve():
            continue
        target = root / "comms"
        if target.is_symlink() and target.resolve() == live:
            pass
        else:
            if target.exists() or target.is_symlink():
                bak = root / f"comms.worktree-bak-{stamp()}"
                target.rename(bak)
            target.symlink_to(live, target_is_directory=True)
            linked += 1
        for rel in (
            "scripts/comms.py",
            "scripts/board_poll_loop.py",
            ".cursor/hooks/agent-briefing.py",
            ".cursor/hooks.json",
            ".cursor/rules/lean-context.mdc",
            ".cursor/rules/team-ownership.mdc",
            ".cursor/rules/ai-context.mdc",
            "comms/README.md",
        ):
            # README lives under live comms/; skip copy into symlink tree
            if rel.startswith("comms/"):
                continue
            if _sync_file(primary / rel, root / rel):
                synced += 1
    print(f"linked={linked} synced={synced} primary={primary.name}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="comms")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("whoami")
    sub.add_parser("link-worktrees")

    p_pulse = sub.add_parser("pulse")
    p_pulse.add_argument("--role", choices=ROLES)

    p_seat = sub.add_parser("seat")
    p_seat.add_argument("--role", choices=ROLES)

    p_check = sub.add_parser("check")
    p_check.add_argument("--role", choices=ROLES)

    p_status = sub.add_parser("status")
    p_status.add_argument("--role", choices=ROLES)
    p_status.add_argument("--all", action="store_true", help="include other roles")

    p_brief = sub.add_parser("briefing")
    p_brief.add_argument("--role", choices=ROLES)

    p_now = sub.add_parser("now")
    p_now.add_argument("--label", default="live")

    p_task = sub.add_parser("task")
    task_sub = p_task.add_subparsers(dest="task_cmd", required=True)

    p_list = task_sub.add_parser("list")
    p_list.add_argument("--owner", choices=ROLES)
    p_list.add_argument("--status", choices=STATUSES)

    p_add = task_sub.add_parser("add")
    p_add.add_argument("--owner", required=True, choices=ROLES)
    p_add.add_argument("--title", required=True)
    p_add.add_argument("--blocked-by", default="")
    p_add.add_argument("--notes", default="")
    p_add.add_argument("--paths", default="", help="comma paths/globs this task may edit")

    p_set = task_sub.add_parser("set")
    p_set.add_argument("id")
    p_set.add_argument("--status", required=True, choices=STATUSES)
    p_set.add_argument("--notes", default="")
    p_set.add_argument("--paths", default="")

    p_notify = sub.add_parser("notify")
    p_notify.add_argument("--from", dest="from_role", required=True, choices=ROLES)
    p_notify.add_argument("--to", required=True)
    p_notify.add_argument("--topic", required=True)
    p_notify.add_argument("--body", required=True)

    p_arch = sub.add_parser("archive")
    p_arch.add_argument("--role", choices=ROLES)
    p_arch.add_argument("--name", required=True)

    p_mile = sub.add_parser("milestone")
    p_mile.add_argument("--label", required=True)
    p_mile.add_argument("--keep", action="append", default=[])

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    dispatch = {
        "whoami": cmd_whoami,
        "pulse": cmd_pulse,
        "seat": cmd_seat,
        "check": cmd_check,
        "status": cmd_status,
        "briefing": cmd_briefing,
        "now": cmd_now,
        "notify": cmd_notify,
        "archive": cmd_archive,
        "milestone": cmd_milestone,
        "link-worktrees": cmd_link_worktrees,
    }
    if args.cmd == "task":
        if args.task_cmd == "list":
            return cmd_task_list(args)
        if args.task_cmd == "add":
            return cmd_task_add(args)
        if args.task_cmd == "set":
            return cmd_task_set(args)
        parser.error(f"unknown task command {args.task_cmd}")
    fn = dispatch.get(args.cmd)
    if fn is None:
        parser.error(f"unknown command {args.cmd}")
        return 2
    return fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
