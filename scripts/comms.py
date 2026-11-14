#!/usr/bin/env python3.11
"""TermalWave agent coordination CLI (board + notify + briefing).

Usage:
  python3 scripts/comms.py whoami
  python3 scripts/comms.py status [--role ROLE]
  python3 scripts/comms.py briefing [--role ROLE]   # lean text for hooks
  python3 scripts/comms.py task list [--owner ROLE] [--status open]
  python3 scripts/comms.py task add --owner ROLE --title "..." [--blocked-by ID,ID]
  python3 scripts/comms.py task set ID --status open|in_progress|blocked|done|cancelled
  python3 scripts/comms.py notify --from ROLE --to ROLE|todos --topic slug --body "..."
  python3 scripts/comms.py archive --role ROLE --name FILENAME
  python3 scripts/comms.py milestone --label day1 [--keep NAME ...]
      # archive old inbox/outbox, park done tasks, rewrite comms/NOW.md
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path


ROLES = ("vps", "carne", "cricri")
STATUSES = ("open", "in_progress", "blocked", "done", "cancelled")


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def detect_role(cwd: Path | None = None) -> str:
    path = str((cwd or Path.cwd()).resolve())
    if path.rstrip("/").endswith("-cricri") or "/nasaspaceappchallenge-cricri" in path:
        return "cricri"
    if path.rstrip("/").endswith("-carne") or "/nasaspaceappchallenge-carne" in path:
        return "carne"
    return "vps"


def board_path() -> Path:
    return repo_root() / "comms" / "board.toml"


def steers_path() -> Path:
    return repo_root() / "comms" / "STEERS.md"


def now_path() -> Path:
    return repo_root() / "comms" / "NOW.md"


def board_done_path() -> Path:
    return repo_root() / "comms" / "board.done.toml"


def steers_archive_path() -> Path:
    return repo_root() / "comms" / "STEERS.archive.md"


def role_dirs(role: str) -> dict[str, Path]:
    base = repo_root() / "comms" / role
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
            "blocked_by",
            "updated",
        ):
            if key not in task or task[key] in (None, "", []):
                continue
            val = task[key]
            if key == "blocked_by":
                inner = ", ".join(f'"{x}"' for x in val)
                lines.append(f"blocked_by = [{inner}]")
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


def cmd_whoami(_: argparse.Namespace) -> int:
    print(detect_role())
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    role = args.role or detect_role()
    tasks = load_board()
    openish = [t for t in tasks if t.get("status") in ("open", "in_progress", "blocked")]
    mine = [t for t in openish if t.get("owner") == role]
    print(f"role={role}")
    print(f"steers={steers_path()}")
    print("--- board (yours) ---")
    if not mine:
        print("(none)")
    for task in mine:
        blocked = task.get("blocked_by") or []
        extra = f" blocked_by={blocked}" if blocked else ""
        print(f"{task['id']} [{task['status']}] {task['title']}{extra}")
    print("--- board (all openish) ---")
    for task in openish:
        print(f"{task['id']} @{task['owner']} [{task['status']}] {task['title']}")
    dirs = role_dirs(role)
    inbox = list_md(dirs["inbox"])
    print(f"--- inbox ({len(inbox)}) ---")
    for path in inbox[:12]:
        print(path.name)
    if len(inbox) > 12:
        print(f"... +{len(inbox) - 12} more")
    return 0


def briefing_text(role: str) -> str:
    """Tiny hook payload. Agents should open NOW.md themselves, not get a novel."""
    tasks = [
        t
        for t in load_board()
        if t.get("owner") == role and t.get("status") in ("open", "in_progress", "blocked")
    ]
    inbox = list_md(role_dirs(role)["inbox"])
    lines = [
        f"[TermalWave] role={role}",
        "Open comms/NOW.md (only). Skip archives/references/vendor.",
        "CLI: python3 scripts/comms.py status | notify | task set | milestone",
    ]
    if tasks:
        lines.append("Tasks: " + "; ".join(f"{t['id']}[{t['status']}] {t['title']}" for t in tasks))
    else:
        lines.append("Tasks: (none)")
    if inbox:
        lines.append("Inbox: " + ", ".join(p.name for p in inbox[:3]))
    else:
        lines.append("Inbox: (empty)")
    lines.append("End turn: task set + archive. Edit code; do not re-read history.")
    return "\n".join(lines)


def cmd_briefing(args: argparse.Namespace) -> int:
    role = args.role or detect_role()
    sys.stdout.write(briefing_text(role))
    if not args.role and not sys.stdout.isatty():
        pass
    sys.stdout.write("\n")
    return 0


def cmd_task_list(args: argparse.Namespace) -> int:
    tasks = load_board()
    for task in tasks:
        if args.owner and task.get("owner") != args.owner:
            continue
        if args.status and task.get("status") != args.status:
            continue
        print(
            f"{task.get('id')}\t{task.get('owner')}\t{task.get('status')}\t{task.get('title')}"
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
        "title": args.title,
        "updated": today(),
    }
    if args.blocked_by:
        task["blocked_by"] = [x.strip() for x in args.blocked_by.split(",") if x.strip()]
        task["status"] = "blocked"
    if args.notes:
        task["notes"] = args.notes
    tasks.append(task)
    write_board(tasks)
    print(task["id"])
    return 0


def cmd_task_set(args: argparse.Namespace) -> int:
    if args.status not in STATUSES:
        print(f"status must be one of {STATUSES}", file=sys.stderr)
        return 2
    tasks = load_board()
    found = False
    for task in tasks:
        if task.get("id") == args.id:
            task["status"] = args.status
            task["updated"] = today()
            if args.notes:
                task["notes"] = args.notes
            found = True
            break
    if not found:
        print(f"unknown task {args.id}", file=sys.stderr)
        return 2
    write_board(tasks)
    print(f"{args.id} -> {args.status}")
    return 0


def cmd_notify(args: argparse.Namespace) -> int:
    if args.from_role not in ROLES:
        print(f"--from must be one of {ROLES}", file=sys.stderr)
        return 2
    targets = list(ROLES) if args.to == "todos" else [args.to]
    for target in targets:
        if target not in ROLES:
            print(f"--to must be todos or one of {ROLES}", file=sys.stderr)
            return 2
    topic = re.sub(r"[^a-z0-9-]+", "-", args.topic.lower()).strip("-") or "note"
    name = f"{stamp()}-{args.from_role}-{args.to if args.to != 'todos' else 'todos'}-{topic}.md"
    body = args.body.strip()
    content = (
        f"# {args.topic}\n\n"
        f"De: {args.from_role}\n"
        f"Para: {args.to}\n"
        f"Estado: abierto\n\n"
        f"## Pedido o feedback\n\n{body}\n\n"
        f"## Respuesta esperada\n\n"
        f"Actualiza board (`scripts/comms.py task set …`) y responde en outbox o notify.\n"
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
    for path in written:
        print(path.relative_to(repo_root()))
    return 0


def cmd_archive(args: argparse.Namespace) -> int:
    role = args.role or detect_role()
    dirs = role_dirs(role)
    src = dirs["inbox"] / args.name
    if not src.is_file():
        # also allow archiving from outbox
        src = dirs["outbox"] / args.name
    if not src.is_file():
        print(f"not found in inbox/outbox: {args.name}", file=sys.stderr)
        return 2
    dirs["archive"].mkdir(parents=True, exist_ok=True)
    dest = dirs["archive"] / src.name
    dest.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    src.unlink()
    print(dest.relative_to(repo_root()))
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
    tasks = [
        t
        for t in load_board()
        if t.get("status") in ("open", "in_progress", "blocked")
    ]
    lines = [
        f"# NOW — {label}",
        "",
        f"Updated: {today()} (UTC date). Hackathon: vibecode lean.",
        "",
        "## Read this turn (and almost nothing else)",
        "",
        "1. This file (`comms/NOW.md`)",
        "2. `comms/board.toml` (open tasks only)",
        "3. New files in your `comms/<rol>/inbox/` (then archive them)",
        "4. `agents/<rol>/AGENTS.md` only if ownership is unclear",
        "",
        "## Do not open unless blocked",
        "",
        "- `comms/**/archive/`, `comms/board.done.toml`, `comms/STEERS.archive.md`",
        "- `references/`, `vendor/`, old prompts history, brand binaries",
        "- Full `AGENTS.md` jury tables (product rules already known)",
        "",
        "## Open tasks",
        "",
    ]
    if not tasks:
        lines.append("(none)")
    for task in tasks:
        blocked = task.get("blocked_by") or []
        extra = f" blocked_by={blocked}" if blocked else ""
        lines.append(
            f"- **{task['id']}** @{task['owner']} [{task['status']}] {task['title']}{extra}"
        )
    lines.extend(
        [
            "",
            "## Focus by role",
            "",
            "- **vps**: pipeline/providers/config/data; keep board/NOW fresh; merge master",
            "- **carne**: React `web/` UX, brand wire, Fuentes panel from `provenance`",
            "- **cricri**: `brand/monigote/`, `web/src/context/`, gusto notes via notify",
            "",
            "## Commands",
            "",
            "```bash",
            "python3 scripts/comms.py status",
            "python3 scripts/comms.py notify --from <rol> --to <rol|todos> --topic … --body '…'",
            "python3 scripts/comms.py task set T00N --status done",
            "python3 scripts/comms.py archive --name <inbox-file.md>",
            "python3 scripts/comms.py milestone --label <next-cut>",
            "```",
            "",
        ]
    )
    path = now_path()
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def cmd_milestone(args: argparse.Namespace) -> int:
    """Compact context after a milestone: archive noise, park done tasks, rewrite NOW."""
    label = args.label.strip() or today()
    keep = set(args.keep or [])
    root = repo_root()
    milestones = root / "comms" / "milestones"
    milestones.mkdir(parents=True, exist_ok=True)
    snap = milestones / f"{stamp()}-{label}.md"

    # Snapshot open board + steers before compacting.
    snap_lines = [
        f"# Milestone snapshot {label}",
        "",
        "## board.toml",
        "```toml",
        board_path().read_text(encoding="utf-8") if board_path().is_file() else "",
        "```",
        "",
        "## STEERS.md",
        "```markdown",
        steers_path().read_text(encoding="utf-8") if steers_path().is_file() else "",
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

    # Park done/cancelled tasks out of the hot board.
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
        write_board(existing_done)
        board_done_path().write_text(board_path().read_text(encoding="utf-8"), encoding="utf-8")
        write_board(active)

    # Compact STEERS: append previous to archive, keep short current.
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
                    "Entradas nuevas arriba. Historial: `STEERS.archive.md` (no leer en turnos normales).",
                    "",
                    f"## {today()} — milestone `{label}`",
                    "",
                    "1. Context lean: agents read `comms/NOW.md` first. Run `milestone` after each big cut.",
                    "2. Open work is only what is on `board.toml` (done tasks live in `board.done.toml`).",
                    "3. Cricri: monigote + context fuentes. Carne: brand + Fuentes React. VPS: merge/unblock.",
                    "",
                    "No secrets in comms.",
                    "",
                ]
            ),
            encoding="utf-8",
        )

    now = write_now_md(label)
    print(f"milestone={label}")
    print(f"archived_messages={archived}")
    print(f"active_tasks={len(active)}")
    print(f"parked_done={len(done)}")
    print(now.relative_to(root))
    print(snap.relative_to(root))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="comms")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("whoami")

    p_status = sub.add_parser("status")
    p_status.add_argument("--role", choices=ROLES)

    p_brief = sub.add_parser("briefing")
    p_brief.add_argument("--role", choices=ROLES)

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

    p_set = task_sub.add_parser("set")
    p_set.add_argument("id")
    p_set.add_argument("--status", required=True, choices=STATUSES)
    p_set.add_argument("--notes", default="")

    p_notify = sub.add_parser("notify")
    p_notify.add_argument("--from", dest="from_role", required=True, choices=ROLES)
    p_notify.add_argument("--to", required=True)
    p_notify.add_argument("--topic", required=True)
    p_notify.add_argument("--body", required=True)

    p_arch = sub.add_parser("archive")
    p_arch.add_argument("--role", choices=ROLES)
    p_arch.add_argument("--name", required=True)

    p_mile = sub.add_parser("milestone")
    p_mile.add_argument("--label", required=True, help="short cut name, e.g. day1-providers")
    p_mile.add_argument(
        "--keep",
        action="append",
        default=[],
        help="inbox/outbox filename to keep unarchived (repeatable)",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.cmd == "whoami":
        return cmd_whoami(args)
    if args.cmd == "status":
        return cmd_status(args)
    if args.cmd == "briefing":
        return cmd_briefing(args)
    if args.cmd == "task":
        if args.task_cmd == "list":
            return cmd_task_list(args)
        if args.task_cmd == "add":
            return cmd_task_add(args)
        if args.task_cmd == "set":
            return cmd_task_set(args)
    if args.cmd == "notify":
        return cmd_notify(args)
    if args.cmd == "archive":
        return cmd_archive(args)
    if args.cmd == "milestone":
        return cmd_milestone(args)
    parser.error(f"unknown command {args.cmd}")
    return 2


if __name__ == "__main__":
    # Avoid printing non-JSON noise when imported by hooks.
    raise SystemExit(main())
