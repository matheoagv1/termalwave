---
name: decorated-txt-docs
description: Write READMEs and docs as decorated plain text. Use only when the
  user explicitly asks for decorated TXT. Otherwise use Markdown.
---

# Decorated TXT docs

## Header

The header is a box on the left with art on the right, then a '=~' rule.

Box:
- Rows: border, project name, border, description, border. The name can carry
  an acronym: "Yeti Package Manager (YPM)".
- The description is flat and short. A longer one wraps onto a second row
  inside the box: "A linux package manager" / "written in Rust."
- Borders are '|' + '-' + '|'. Text rows are '| ' + text padded + ' |'.
- Fixed inner width, 25 to 35 columns, wide enough for the name. Every row has
  the same length.

Art, 3 to 5 spaces to the right of the box. Pick one of three:
- figlet only
- drawing only
- both side by side

How to choose:
- Count the space. Total line width stays under 80 columns, so the art gets
  80 minus the box width minus the gap. With a 30 column box that is about 45.
- Use both only if they fit with room to breathe. If the header feels crowded
  or overcharged, drop to one.
- A long project name usually rules out figlet or forces a smaller font. A
  tall or wide drawing usually rules out the pairing.
- No default. A figlet alone suits a name that is short and punchy. A drawing
  alone suits a mascot or a theme. Both suit a short name with a small
  drawing.

Figlet:
- Generate it with a program, never by hand. Run 'figlet -f slant NAME' or
  'pyfiglet'. Slant is the preferred font. Only change it if the user asks or
  the name does not fit. Check the width of the output.

Drawing:
- Get it from the internet (web search, archives like asciiart.eu). Copy it
  exactly and keep the artist's signature.
- Never draw it yourself. LLMs are bad at it. If no decent piece is found,
  leave a '[ascii drawing goes here]' placeholder and tell the user.
- 5 to 8 lines tall, under about 30 columns when sharing the row with a
  figlet. It can be taller than the box. If it is, the extra lines run
  alongside the '=~' rule row below the box.
- Subject can be related to the project (an animal, a creature, a character,
  a mascot) or unrelated.

Build the header with a script (python or shell) so box rows and art lines
align exactly. Do not eyeball it.

Under the box goes a rule: '=~' repeated to about the box width, ending on
either '=' or '~'.

## Body

- Plain text. No Markdown syntax (no #, **, tables, code fences).
- Hard wrap at about 80 columns. Up to 90 is fine for a single long line.
- Blank line after the rule, then an intro paragraph of two or three
  sentences. It says what the project is and one thing it does or aims for.
  No preamble.
- Section heading is '=== TITLE', then on the next line '=' repeated to the
  exact length of the heading line, then a blank line. Keep casing consistent
  inside one document. All caps is the common choice.
- Inline code and commands go in single quotes ('cargo build --release') or
  backticks (`cargo build`). Pick one per document. A bare command on its own
  line is fine, as in a Usage block. Forward slashes everywhere.
- Steps are numbered lists ('1. ', '2. '). One action per step.
- Plain lists use '- '.
- Progress lists use [x] done, [-] partial, [ ] not started, nested with 4
  spaces. Follow the list with a Key block that explains the three marks.
- Dry, direct voice. Say what the thing does and does not do. Short. A bit of
  personality is fine. No marketing, no apologies.
- Use real commands, file names and flags. Never invent features.

## Usage block

- First line is the bare invocation: 'tool [OPTIONS] [ARGUMENTS]'.
- Then a blank line and 'Options:'.
- Options are indented 2 spaces, sorted alphabetically, and use '=>' between
  the flag and its description, one line each:
    -c => Clear the package cache
    -h => Show this help
- Close with a pointer if one exists: "The man page has more information."

## Typical sections

Pick only what applies, in roughly this order:
- Usage
- Building or Installation
- Configuration
- Progress
- Bugs: one or two honest sentences. Say it is in progress, probably has bugs,
  and where to report them.
- Possible future additions
- Inspiration (list of projects and links, no particular order)
- Contributing: "Issues and pull requests are welcome."
- Mascot (optional, one line)

A website or sub-repo README can be just the header, one sentence and
Contributing.

## Example

Figlet only. The figlet is real 'figlet -f slant' output.

|-------------------------------|       _________ ____  _____
| ISOS                          |      /  _/ ___// __ \/ ___/
|-------------------------------|      / / \__ \/ / / /\__ \
| Idealistically Simple OS.     |    _/ / ___/ / /_/ /___/ /
|-------------------------------|   /___//____/\____//____/
=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=~=

ISOS is a small operating system meant to be read in one sitting. It has a
kernel, a shell and nothing else.

=== USAGE
=========

isos [OPTIONS] [IMAGE]

Options:
  -h => Show this help
  -m => Set memory size in MB
  -v => Get version information

The man page has more information.

=== INSTALLATION
================

1. Run 'make' to build 'isos.iso'
2. Boot it with 'qemu-system-x86_64 -cdrom isos.iso'

=== PROGRESS
============

[x] Bootloader
[-] Kernel
    [x] Memory manager
    [-] Scheduler
    [ ] Filesystem
[ ] Shell

Key:

[ ] = not started
[-] = partially implemented
[x] = fully implemented

=== BUGS
========

ISOS is still in progress and probably has bugs. You can report them under the
issues tab.

=== CONTRIBUTING
================

Issues and pull requests are welcome.

Drawing only and both are the same layout with the right side swapped. For
both, the drawing goes first and the figlet after it, on the same rows as the
box.
