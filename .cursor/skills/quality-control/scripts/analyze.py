#!/usr/bin/env python3
import argparse
import re
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "lib"))

import jev
import rules

DEFAULTS = {"mode": "prose", "register": "ES-AR-SGO", "formality": "formal"}
TOLERANCE = 0.5
WINDOW_WORDS = 80
WORKERS = 8
FOCUS = (
    "Answer yes only if `document` itself breaks `rule`. The examples inside "
    "`rule` are not part of `document`, and silence on the subject is not a violation."
)

FENCE = re.compile(r"^\s*(```+|~~~+)")
RULE_LINE = re.compile(r"^\s*(?:-{3,}|={3,})\s*$")
BOX_EDGE = re.compile(r"^\s*={10,}\s*$")
BOX_TITLE = re.compile(r"^\s*=.*=\s*$")
SUBSECTION = re.compile(r"^\s*=~=\s*(.*?)\s*=~=\s*$")
ATX = re.compile(r"^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$")


def question(rule, heading=False):
    text = "Does `document` break `rule`?"
    focus = FOCUS
    if heading:
        text = "Does the heading in `document` break `rule`?"
        focus += " `document` is one heading from a document, not the document title."
    return {
        "type": "noul",
        "instructions": {
            "question": text,
            "focus": focus,
            "rule": {"title": rule.title, "text": rule.body},
        },
    }


def tolerance(rule):
    return float(rule.meta.get("tolerance", TOLERANCE))


def scope(rule):
    return rule.meta.get("scope", "window")


def strip_fences(text):
    out, fence = [], None
    for line in text.split("\n"):
        m = FENCE.match(line)
        if m:
            mark = m.group(1)[0]
            if fence is None:
                fence = mark
            elif fence == mark:
                fence = None
            continue
        if fence is None:
            out.append(line)
    return out


def skip_header(lines):
    for i in range(len(lines) - 2):
        if BOX_EDGE.match(lines[i]) and BOX_TITLE.match(lines[i + 1]) and BOX_EDGE.match(lines[i + 2]):
            return i + 3
    return 0


def body_text(text):
    lines = strip_fences(text)
    out = []
    for line in lines[skip_header(lines):]:
        if RULE_LINE.match(line):
            continue
        m = SUBSECTION.match(line)
        if m:
            out.append(m.group(1))
            continue
        m = ATX.match(line)
        if m:
            out.append(m.group(1))
            continue
        out.append(line)
    body = "\n".join(out)
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()


def heading_text(text):
    lines = strip_fences(text)
    found = []
    for i, line in enumerate(lines):
        m = ATX.match(line)
        if m:
            found.append(m.group(1))
            continue
        m = SUBSECTION.match(line)
        if m:
            found.append(m.group(1))
            continue
        if not line.strip() or not (i + 1 < len(lines) and RULE_LINE.match(lines[i + 1])):
            continue
        if i > 0 and BOX_EDGE.match(lines[i - 1]):
            continue
        found.append(line.strip())
    seen, out = set(), []
    for h in found:
        if h not in seen:
            seen.add(h)
            out.append(h)
    return out


def windows(text, words=WINDOW_WORDS):
    text = "\n".join(line for line in text.split("\n") if line.strip())
    blocks = [b for b in re.split(r"\n\s*\n", text) if b.strip()]
    out, cur = [], []
    for block in blocks:
        for sentence in re.split(r"(?<=[.!?])\s+", block):
            if not sentence.strip():
                continue
            if cur and len(" ".join(cur + [sentence]).split()) > words:
                out.append(" ".join(cur))
                cur = []
            cur.append(sentence)
    if cur:
        out.append(" ".join(cur))
    return out


def detect_lang(text):
    body = body_text(text)
    resp = jev.ask({"document": body or text}, {"lang": {
        "type": "choice",
        "instructions": "Which language is `document` written in?",
        "criteria": {"en": "English", "es": "Spanish"},
    }})
    return resp["answers"]["lang"]["choice"]


def score(raw, chosen, repeat, code):
    body = raw if code else body_text(raw)
    heads = [] if code else heading_text(raw)
    groups = {}
    for i, rule in enumerate(chosen):
        groups.setdefault(scope(rule), []).append(i)
    jobs = []
    if body and "document" in groups:
        jobs.append((body, groups["document"]))
    if body and "window" in groups:
        for window in windows(body):
            jobs.append((window, groups["window"]))
    if heads and "heading" in groups:
        for head in heads:
            jobs.append((head, groups["heading"]))
    rounds, model = [], None
    for _ in range(repeat):
        with ThreadPoolExecutor(WORKERS) as ex:
            resps = list(ex.map(lambda job: jev.ask({"document": job[0]}, {str(i): question(chosen[i], scope(chosen[i]) == "heading") for i in job[1]}), jobs))
        probs = [None] * len(chosen)
        for (_, indices), resp in zip(jobs, resps):
            model = resp.get("model") or model
            for i in indices:
                value = resp.get("answers", {}).get(str(i), {}).get("noul")
                if value is None:
                    continue
                if probs[i] is None or value > probs[i]:
                    probs[i] = value
        rounds.append(probs)
    final = []
    for i, rule in enumerate(chosen):
        values = [r[i] for r in rounds if r[i] is not None]
        if values:
            final.append(statistics.median(values))
        elif scope(rule) == "heading" and not heads:
            final.append(0.0)
        elif scope(rule) in ("window", "document") and not body:
            final.append(0.0)
        else:
            final.append(None)
    return model, final


def show(rule, level):
    print("%s %s\n\n%s\n" % ("#" * level, rule.title, rule.body))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("file", nargs="?")
    p.add_argument("--lang", choices=["en", "es", "auto"], default="auto")
    p.add_argument("--register", default=DEFAULTS["register"])
    p.add_argument("--informal", action="store_true")
    p.add_argument("--code", action="store_true")
    p.add_argument("--related", action="store_true")
    p.add_argument("--scores", action="store_true")
    p.add_argument("--repeat", type=int, default=1, metavar="N",
                   help="ask each judgment N times and keep the median")
    p.add_argument("--model", default=None, metavar="ID",
                   help="override the pinned Jev model for this run")
    a = p.parse_args()

    if a.model:
        jev.MODEL = a.model

    sys.stdout.reconfigure(encoding="utf-8")
    text = open(a.file, encoding="utf-8").read() if a.file else sys.stdin.read()

    try:
        lang = detect_lang(text) if a.lang == "auto" else a.lang
        active = {**DEFAULTS, "lang": lang, "register": a.register}
        if a.informal:
            active["formality"] = "informal"
        if a.code:
            active["mode"] = "code"
        chosen = [r for r in rules.load_all(ROOT / "rules") if rules.applies(r, active)]
        if not chosen:
            sys.exit("no rules apply to %s" % active)
        model, probs = score(text, chosen, max(1, a.repeat), a.code)
    except (jev.JevError, ValueError) as e:
        sys.exit("error: %s" % e)

    failed = [r for r, v in zip(chosen, probs) if v is not None and v >= tolerance(r)]
    unscored = [r for r, v in zip(chosen, probs) if v is None]

    shown = set(map(id, failed))
    for r in failed:
        show(r, 3)
        if a.related:
            for x in r.related:
                if id(x) not in shown and x in chosen:
                    shown.add(id(x))
                    show(x, 4)

    if a.scores:
        print("model %s" % (model or "unknown"), file=sys.stderr)
        for r, v in zip(chosen, probs):
            print("%s\t%.3f\t%s" % ("-" if v is None else "%.3f" % v, tolerance(r), r.title), file=sys.stderr)
    for r in unscored:
        print("unscored: %s" % r.title, file=sys.stderr)
    sys.exit(1 if failed else 2 if unscored else 0)


if __name__ == "__main__":
    main()
