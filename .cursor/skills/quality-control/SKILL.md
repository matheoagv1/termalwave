---
name: quality-control
description: |
  Score text against the user's writing rules through TypeSafe's Jev and
  quote back every rule it breaks. Load it instead of humanizer for any
  writing, editing, or reviewing task: prose, school work, localization
  strings in Spanish or English, and code comments. Spanish defaults to
  ES-AR-SGO formal.
license: MIT
compatibility: claude-code opencode
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

# quality-control

Every judgment is a Jev Noul. There is no regex or keyword path, and none should be added.

## Run

```bash
export TYPESAFE_API_KEY=...
python3 scripts/analyze.py file.txt            # stdin if no file
python3 scripts/analyze.py --lang es --register ES-ES --informal file.txt
python3 scripts/analyze.py --code module.py
python3 scripts/analyze.py --related file.txt
python3 scripts/analyze.py --repeat 3 file.txt     # median of three judgments
python3 scripts/analyze.py --model jev-preview file.txt
```

`--lang` defaults to auto (Jev picks). Registers: ES-AR-SGO (default), ES-AR, ES-ES, ES-ES-BA. `--scores` prints every probability and its tolerance to stderr.

## Model

`lib/jev.py` pins `jev-1.14.0` and defaults to `https://api.typesafe.ai`. Override the model with `JEV_MODEL` or `--model`, and the origin with `JEV_API_BASE_URL`. The key comes from `JEV_API_KEY` or `TYPESAFE_API_KEY`. Both response shapes are accepted: the direct TypeSafe result and the hosted Jev envelope.

Tolerances are tuned for the pinned version. Changing the model requires retuning.

## Output

Each broken rule is printed as written in `rules/`, heading included. With `--related`, the related rules follow one heading level deeper. Quote them back as they are. Do not paraphrase, and do not rewrite the text unless asked.

Exit 0: clean. Exit 1: a rule was broken. Exit 2: a rule could not be scored, and stderr names it. An unscored rule is unknown, not passed, so say so.

## Rules

One file per concern in `rules/`: `anti_ai_patterns.md`, `ideological.md`, `stylistic_en.md`, `stylistic_es.md`.

A rule is a `###` section. Its body is what Jev judges against and what is quoted back. To add a rule, add a section. To change it, edit it. To remove it, delete it. No code names any rule.

Optional `<!-- key: value -->` lines under a heading apply to that heading and everything below it:

- `tolerance: 0.35` is the yes-probability at which the rule fails. Default 0.5, lower is stricter.
- `scope: window` is the default. It judges the rule on windows of about 80 words and keeps the highest score. Jev drifts toward 0.5 on long documents, so this is the safe default for rules about a local feature.
- `scope: document` judges the whole text. Use it for rules that need the whole document, such as synonym cycling.
- `scope: heading` judges only the document's headings. Use it for heading rules, so body prose cannot trigger them.
- `related: Title | Title` adds related rules by exact title, in both directions. Rules under the same `##` are always related.
- Any other key decides when the rule applies. A run sets `lang`, `mode` (prose or code), `register`, and `formality`. The rule applies when its space-separated values include the run's value. Keys it does not name are ignored.

The analyzer removes fenced code blocks, section rules, and the decorated header before prose scoring, and extracts headings for `scope: heading`. That is text selection, not rule detection: every verdict is still a Jev Noul.

`anti_ai_patterns.md` and `ideological.md` name no `lang`, so they apply to both languages. Rules that depend on English morphology or vocabulary carry `<!-- lang: en -->`; Spanish equivalents live in `stylistic_es.md`. The code comment rules in `stylistic_en.md` are not language-tagged, so `--code` applies them to code in either language. Add `<!-- lang: en -->` under the file title to restrict a whole file.

Tolerances are tuned per Jev version. After tuning, pin it with `JEV_MODEL` or `--model`.
