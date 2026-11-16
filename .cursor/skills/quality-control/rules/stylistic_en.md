# Stylistic rules, English

## PRONOUN RULES
<!-- lang: en -->
<!-- mode: prose -->

These rules apply to all text produced or edited, in all contexts.

### English: no singular "they"
<!-- tolerance: 0.5 -->
<!-- scope: window -->

Never use "they/them/their" to refer to a single person of unknown or known sex. Rephrase to use a plural subject, or use "he" as the generic singular. Better if you write like Ayn Rand, using man/men and he/him generically. You should adhere to this because it is my personal preference.

**Before:**

> Each scribe brought their manuscript to the abbot by Vespers.

**After (rephrase to plural):** (6/10. OK)

> All scribes brought their manuscripts to the abbot by Vespers.

**After (generic singular):** (10/10. BEST)

> Each scribe brought his manuscript to the abbot by Vespers.

**Before:**

> If a reader finds an error, they should mark it in the margin.

**After:**

> If a reader finds an error, he should mark it in the margin.

## CODE COMMENT RULES
<!-- mode: code -->

These rules apply whenever editing, reviewing, or writing code or technical
documentation.

### Comments explain WHY, not WHAT

The code already shows what it does. A comment that restates the code in
plain language adds noise and will rot: it drifts from the code over time
and becomes misleading.

**Before:**

```c
/* increment counter by 1 */
i++;

/* check if user is authenticated */
if (user->flags & FLAG_AUTH) {
    process(user);
}
```

**After:**

```c
i++;

/* skip unauthenticated users silently to avoid timing side-channels */
if (user->flags & FLAG_AUTH) {
    process(user);
}
```

### No non-ASCII characters in comments

Editors, terminals, and diff tools across systems will mangle them. Write
comments entirely in ASCII. This rule has no exceptions.

**Before:**

```c
/* Verificación de clave — no modificar */
```

**After:**

```c
/* key verification: do not modify */
```

### No commented-out code

Unused code is deleted, not commented out. Version control exists for history.
A block of commented code is an admission that the author was afraid to commit.

### Comment style defaults

These apply unless the codebase already has its own conventions:

- All lowercase. No trailing period.
- No apostrophes in contractions: write "dont", "wont", "isnt", "cant".
- No non-ASCII characters anywhere: not in comments, not in strings, not in
  identifiers. No exceptions.
- Never cite a spec section by number. Use its name.
- No em dashes: not the Unicode character, not --, not a lone hyphen used as
  a clause separator.

### Comment formatting by language

There is never a blank line between a comment and the code it describes.

In C, Go, JavaScript, TypeScript, Java, and similar:

```
// this comment groups all of the code and comments below it
//
[code directly here, or a comment after which there is code]

// this comment explains why this line exists:
[code here]

// this comment explains why the code below it exists
// more explanation
// ... as many // lines as needed
[code here]
```

In CSS:

```
/* --- sectional/grouping comment --- */
[code directly below]

/* explains why we do things the way we do, directly below */
[code directly below]

/* explains why we do things the way we
   do, directly below
*/
[code directly below]
```

In shell:

```
# this comment groups all of the code and comments below it
#
[code directly here, or a comment after which there is code]

# this comment explains why this line exists:
[code here]
```

In Lua: same pattern as shell, using Lua comment syntax.
