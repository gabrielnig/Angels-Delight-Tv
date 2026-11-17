# AI Code Footprint Checklist (Master Spec)

**Reusable across all projects.** Patterns that reveal code was
AI-generated rather than hand-written, why they matter beyond
appearance, and the concrete rule to follow instead. Applies to code,
comments, commit messages, and any user-facing copy the assistant
writes, not just prose.

---

## 1. Why This Matters, Not Just Cosmetically

Some of these tells are pure style and only matter for how the work
reads to a reviewer or a future maintainer. Others point at a real
defect class:

- Silent exception handling and swallowed errors are the most
  consequential tell. Code that fails quietly while still returning a
  value is a documented, measured pattern in AI-generated code, and in
  a codebase with real authorization logic, a swallowed exception in
  the wrong place is a security bug, not a style nit.
- Over-engineering (unrequested abstraction layers, interfaces for a
  single implementation) adds surface area a reviewer has to
  understand and a future change has to work around, real cost, not
  just noise.
- Everything else on this list (naming, comments, uniform style, commit
  hygiene) is about a codebase reading as deliberately authored rather
  than generated. That matters for review trust and for the next
  developer's ability to reason about intent.

## 2. The Checklist

- **Over-engineering.** A Factory pattern, multiple abstract classes,
  or dependency injection for something a plain function or a single
  class would solve. Rule: build the simplest thing that satisfies the
  actual requirement, add structure only when a second real use case
  shows up, not preemptively.
- **Silent failure under error conditions.** Try/catch blocks that
  swallow an exception instead of surfacing it, especially around
  authorization, payment, or data-integrity code. Rule: an error either
  gets handled with a specific, intentional fallback, or it propagates,
  never a bare catch that returns success-shaped output.
- **Excessive or redundant comments.** Comments that restate what the
  code obviously does, line by line. Rule: comment why a non-obvious
  decision was made, not what the next line does.
- **Generic, boilerplate naming.** `handleData()`, `processItem()`,
  `data`, `result`, `item`, `temp`. Rule: name things after the actual
  domain concept they represent.
- **Uniform, textbook-perfect style with no texture.** Every function
  the same shape, no shortcuts, no "this is a bit ad hoc but it's
  fine" pragmatism a real engineer leaves behind under real
  constraints. This one is a weak signal on its own, don't chase it by
  deliberately adding inconsistency, but treat suspiciously uniform
  code as a prompt to check the other items on this list.
- **Defensive over-validation applied uniformly.** Null-checks and
  guard clauses added mechanically even where a type system or a DB
  constraint already guarantees the value can't be null. Rule: validate
  at real trust boundaries (external input, cross-service calls), not
  everywhere out of habit.
- **Em dashes, en dashes, and smart-quote artifacts.** One of the most
  recognizable LLM writing tics, and it shows up in code comments,
  commit messages, and UI copy just as easily as prose. Rule: never use
  them, use a period, comma, or parentheses instead. Grep the diff for
  the em dash and en dash characters before considering a change done.
- **"Too clean" commit history.** One large, complete commit with no
  evidence of iteration, a dead end, or a fix-up, when the change was
  genuinely nontrivial. Rule: this matters more for human-authored
  work with agent assistance than for a single agentic session, but
  when commits are split, make the split reflect real checkpoints, not
  an arbitrary line count.
- **Generic or vague commit messages.** "Update files", "fix stuff",
  versus a message naming the actual decision or bug. Rule: state what
  changed and why in one line, specific enough that reading the log
  later tells the real story.

## 3. How to Apply This During a Build Session

1. Before considering a batch of work done, grep the diff for the em
   dash and en dash characters across every changed file, code,
   comments, docs, commit message draft.
2. Read through new comments and ask: does this explain a decision, or
   does it just restate the code? Delete the ones that just restate.
3. Look for any class, function, or parameter that exists but isn't
   used by anything yet, that's a strong sign of speculative
   structure added ahead of need. Remove it or justify it explicitly.
4. Check delete/cascade behavior and error handling around any new
   authorization, payment, or data-integrity logic specifically for
   silent-failure patterns, this is the one item on this list with
   real security consequences, not just style.
5. A passing test suite does not substitute for this pass. Tests only
   prove what they were written to check. Run this checklist as a
   separate, deliberate step even when the suite is green.

## Reuse Notes

- The security-consequential item (silent failure) applies to every
  stack. The stylistic items apply to any language with comments and
  a commit history, adjust examples (e.g. naming conventions) to the
  project's actual style guide if one exists.
- Where a project has an automated linter/formatter (Pint, ESLint,
  Prettier, etc.), that catches formatting but not this list, run both.
