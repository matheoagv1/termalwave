---
name: coding
description: |
  ALWAYS LOAD THIS SKILL when writing, editing, reviewing, or discussing code
  in any language. Covers: how to explore an existing codebase before touching
  it, code conventions (DRY, orthogonality, portability), comment rules, import
  ordering, and error handling. Comment rules are overridden by the stylistic
  practices of the codebase being worked in, or by an explicit CLAUDE.md or
  GEMINI.md in the project root.
license: MIT
compatibility: claude-code opencode
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---

# Coding rules


## Starting work in a preexisting project

Do not assume anything about a codebase's conventions. Explore it first:

1. Read a representative sample of source files across different subsystems.
2. Read the commit log if available. Comments age faster than code; commits show
   intent that comments miss.
3. Identify the hidden invariants: naming conventions, allocation patterns,
   error handling style, struct layout discipline, how the author structures
   loops, what the author never does (malloc without a matching free path,
   global mutable state, etc.).
4. Identify the formatting invariants: indentation width, brace style, alignment
   of assignments, how long lines are handled, how macros are written.
5. Identify the comment invariants: uppercase vs lowercase, trailing period or
   not, what ratio of lines have comments, whether comments are inline or above.
6. Write those invariants down before writing any code. When in doubt about a
   convention, look at three more files. The answer is always already in the
   codebase.

Never introduce a style, pattern, or idiom not already present unless explicitly
asked. The codebase is the spec.


## Comment rules

These defaults apply unless the codebase already has its own comment conventions
(detected during exploration above), or unless a CLAUDE.md or GEMINI.md in the
project root says otherwise. Codebase style wins.

Comments explain WHY. Not what the code does. The code shows that. A comment
belongs only when a future maintainer reading the code cold would not understand
why something is done that way. "increment i" is noise. "fnv-1a" above a hash
loop names the algorithm without restating the code. "skip unauthenticated users
silently to avoid timing side-channels" explains a decision that is otherwise
invisible.

Comments are all lowercase. No trailing period. No apostrophes in contractions:
write "dont", "wont", "isnt", "cant", "abt" (for about). No non-ASCII characters
anywhere: not in comments, not in strings, not in identifiers.

Do not comment out code. Delete it. Version control keeps the history.

No em dashes anywhere: not the Unicode em dash, not the double-hyphen, not a
lone hyphen used as a clause separator.

A comment is bad if it cites a spec section by number instead of by name.

Formatting by language (overridden by codebase or project config):

In C, Go, JavaScript, TypeScript, Java, and similar:

```
// This comment groups all of the code and comments below it
//
[code directly here, or a comment after which there is code]

// This comment explains WHY this line exists:
[code here]

// This comment explains WHY the code below it exists
// More explanation
// ... as many // lines as needed
[code here]
```

In CSS:

```
/* --- sectional/grouping comment --- */
[code directly below]

/* explains WHY we do things the way we do, directly below */
[code directly below]

/* explains WHY we do things the way we
   do, directly below
*/
[code directly below]
```

In shell scripts:

```
# This comment groups all of the code and comments below it
#
[code directly here, or a comment after which there is code]

# This comment explains WHY this line exists:
[code here]
```

In Lua: same pattern as shell, using Lua comment syntax.

There is never a blank line between a comment and the code it describes.


## Includes and imports

Project headers before system headers, with a blank line between. System headers
in alphabetical order:

```c
#include "myproject.h"
#include "internal.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
```

Match the conventions of the codebase if it does it differently.


## General code principles

Code must be portable, orthogonal, and DRY. If the same logic appears twice,
it goes into a function. If a function does two things, it becomes two functions.
If a constant appears twice, it gets a name.

Match the style and idioms already in the codebase exactly. A formatter that
preserves custom alignment is fine. A formatter that destroys it is not.

No typedef struct. No padding the code with explanations that a competent
programmer in the relevant language would already know.


## Error handling

Follow the pattern already in the codebase. If the codebase checks every return
value, check every return value. If it uses a single error-propagation path,
use that path. Do not introduce a new error-handling convention.

## Final checklist before any code output

- Does it match the surrounding style exactly?
- Are all comments lowercase, ASCII-only, explaining WHY?
  (Unless the codebase or project config overrides this.)
- Is there a blank line between any comment and the code it describes?
  (There should not be.)
- Are there any commented-out blocks? Delete them.
- Are there any em dashes or non-ASCII characters anywhere?
- Does every function do exactly one thing?
- Is any logic duplicated that should be in a shared function?
