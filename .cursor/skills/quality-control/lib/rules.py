from dataclasses import dataclass, field
from pathlib import Path

# every other meta key is a selector: the rule applies only when the run has that key set to one of its values
RESERVED = ("tolerance", "related", "scope")


@dataclass(eq=False)
class Rule:
    title: str
    body: str
    group: str
    meta: dict
    related: list = field(default_factory=list)


def meta_line(line):
    s = line.strip()
    if not (s.startswith("<!--") and s.endswith("-->")):
        return None
    key, _, value = s[4:-3].partition(":")
    return key.strip(), value.strip()


def heading(line):
    level = len(line) - len(line.lstrip("#"))
    if 1 <= level <= 3 and line[level:level + 1] == " ":
        return level, line[level + 1:].strip()
    return None


def parse(path):
    rules, metas = [], {1: {}, 2: {}, 3: {}}
    level, group, open_rule, fence = 0, "", None, False

    def close():
        if open_rule:
            title, body = open_rule
            meta = {**metas[1], **metas[2], **metas[3]}
            rules.append(Rule(title, "\n".join(body).strip("\n"), group, meta))

    for line in Path(path).read_text(encoding="utf-8").split("\n"):
        if line.startswith("```"):
            fence = not fence
        h = None if fence else heading(line)
        if h:
            close()
            level, text = h
            for n in range(level, 4):
                metas[n] = {}
            if level == 2:
                group = text
            open_rule = (text, []) if level == 3 else None
            continue
        m = None if fence else meta_line(line)
        if m:
            metas[level or 1][m[0]] = m[1]
        elif open_rule:
            open_rule[1].append(line)
    close()
    return rules


def link(rules, path):
    by_title = {}
    for r in rules:
        by_title.setdefault(r.title, []).append(r)
        r.related = [x for x in rules if x is not r and x.group == r.group]
    for r in rules:
        for title in filter(None, (s.strip() for s in r.meta.get("related", "").split("|"))):
            if len(by_title.get(title, [])) != 1:
                raise ValueError("%s: related title missing or ambiguous: %s" % (path, title))
            other = by_title[title][0]
            if other not in r.related:
                r.related.append(other)
            if r not in other.related:
                other.related.append(r)


def load_all(directory):
    out = []
    for path in sorted(Path(directory).glob("*.md")):
        rules = parse(path)
        link(rules, path)
        out += rules
    return out


def applies(rule, active):
    return all(active.get(k) in v.split() for k, v in rule.meta.items() if k not in RESERVED)
