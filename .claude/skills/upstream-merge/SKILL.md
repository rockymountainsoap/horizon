---
name: upstream-merge
description: >-
  Merge a new Shopify Horizon upstream release into the Rocky fork. Use when
  pulling/updating from upstream Horizon, bumping the theme to a new Horizon
  version, reconciling merge=ours files after an upstream release, or when the
  user says "merge upstream", "update from Horizon", "pull the new Horizon
  version", "do an origin merge strategy", or references a horizon-update-*
  branch. Encodes the staging-branch workflow, file categorization, conflict
  resolution, merge=ours reconciliation, and verification — distilled from the
  v3.5.1 merge.
---

# Upstream Horizon Merge — Rocky Fork Playbook

This repo is a **managed fork of Shopify Horizon**. `merge=ours` in `.gitattributes`
keeps Rocky's version of customized upstream files when merging from upstream.
The job of a merge is to pull Shopify's improvements **without overwriting Rocky
code**, then **manually graft** the safe upstream changes back into the files
`merge=ours` protected.

Read this whole file before acting. It is the operational companion to
`CLAUDE.md` → **Upstream Update Protocol** and
`.cursor/references/gitattributes-merge-strategy.md`.

**Hard rules (never violate):**
- Do the merge on a **staging branch**, never on `main` directly.
- **Never push** without explicit user approval — pushing is outward-facing.
- Rocky-owned files are `r-*`; the merge must touch **zero** `r-*` files.
- Promote to `main` only after the user has tested on a preview theme.

---

## Phase 0 — Preflight (must all pass)

```bash
git remote -v                        # 'upstream' must point at Shopify/horizon
git config --get merge.ours.driver   # must print 'true' — else: git config merge.ours.driver true
git status                           # working tree MUST be clean before starting
```

If `merge.ours.driver` is unset, the `merge=ours` strategy silently does a normal
3-way merge and **Rocky code gets overwritten**. Do not proceed until it prints `true`.

---

## Phase 1 — Fetch & assess

```bash
git fetch upstream --prune
BASE=$(git merge-base main upstream/main); echo "$BASE" > /tmp/base_sha.txt
git rev-list --count main..upstream/main                       # new upstream commits
git diff --stat "$BASE" upstream/main | tail -1                # scope (files / +/-)
git log --oneline --no-merges main..upstream/main | head       # what shipped (find the version tag)
```

The locally-cached `upstream/main` is often months stale — **always fetch first**.
Note the target version (e.g. "Horizon v3.5.1") for the branch name and release notes.

---

## Phase 2 — Categorize the changed set (do this BEFORE merging)

The merge has predictable buckets. Build them explicitly so nothing is silently lost.

```bash
BASE=$(cat /tmp/base_sha.txt)
git diff --name-only "$BASE" upstream/main | sort -u > /tmp/upstream_changed.txt
grep "merge=ours" .gitattributes | grep -v '^#' | awk '{print $1}' | sort -u > /tmp/ours_files.txt

echo "== merge=ours files upstream changed (the review surface) =="
comm -12 /tmp/ours_files.txt /tmp/upstream_changed.txt | tee /tmp/conflict_review.txt
```

Then split that review surface — **this distinction is the crux of the whole merge:**

```bash
BASE=$(cat /tmp/base_sha.txt)
echo "== both-changed (driver keeps OURS → upstream dropped → must reconcile) =="
while read f; do git diff --quiet "$BASE" main -- "$f" || echo "  $f"; done < /tmp/conflict_review.txt
echo "== upstream-only (we never customized → upstream flows in cleanly) =="
while read f; do git diff --quiet "$BASE" main -- "$f" && echo "  $f"; done < /tmp/conflict_review.txt
```

**The danger check** — a file Rocky customized but forgot to register `merge=ours`
gets a silent 3-way auto-merge and can lose Rocky code:

```bash
BASE=$(cat /tmp/base_sha.txt)
echo "== both-changed but NOT merge=ours (silent 3-way risk) =="
while read f; do
  grep -qxF "$f" /tmp/ours_files.txt && continue
  git diff --quiet "$BASE" main -- "$f" || echo "  ⚠ $f"
done < /tmp/upstream_changed.txt
```

In v3.5.1 this surfaced only deleted non-English locales + `release-notes.md` (all
benign). If it surfaces a **Liquid/section/block/template** file, stop and decide
per-file before merging — and add it to `.gitattributes` if it should be protected.

| Bucket | Merge behavior | Action |
|---|---|---|
| Unprotected, upstream-only | Flows in cleanly | none |
| `merge=ours`, upstream-only | Flows in (driver not invoked) | none |
| `merge=ours`, **both-changed** | **Keeps ours** | reconcile in Phase 6 |
| Deleted non-English locales | modify/delete conflict | `git rm` (keep deleted) |
| `release-notes.md` | content conflict | hand-merge |

---

## Phase 3 — Staging branch + merge

```bash
git checkout -b horizon-update-$(date +%Y%m%d-%H%M%S)-vX.Y.Z
git merge upstream/main --no-edit
```

Expect it to stop on conflicts. The `merge=ours` both-changed files report
`Auto-merging …` with **no conflict** — that is the driver keeping our version
(correct). Real conflicts will be locales + `release-notes.md`.

---

## Phase 4 — Resolve conflicts

```bash
git status --porcelain | grep -E '^(DD|AU|UD|UA|DU|AA|UU)'   # see all unmerged paths
```

- **`DU` (deleted-by-us) locales** → Rocky ships **English + French only**; all
  other `locales/*.json` were deliberately deleted. Keep them deleted:
  ```bash
  git rm $(git status --porcelain | awk '/^DU /{print $2}')
  ```
- **`release-notes.md` (`UU`)** → keep Rocky's top section, then add the new
  upstream version block, then keep the historical entries. Hand-edit the markers out.
- **`merge=ours` both-changed** → no action; the driver already kept ours.

---

## Phase 5 — Verify the merge (before committing)

```bash
BASE=$(cat /tmp/base_sha.txt)
# (a) protected both-changed files kept OURS (expect identical to main):
for f in <both-changed list>; do git diff --quiet main -- "$f" && echo "✓ $f" || echo "✗ $f"; done
# (b) NO r-* file touched:
git diff --cached --name-only HEAD | grep -E '(^|/)r-' || echo "✓ no r-* modified"
# (c) no stray conflict markers:
grep -rlE '^(<<<<<<<|>>>>>>>)' --include='*.liquid' --include='*.json' . | grep -v node_modules || echo "✓ clean"
```

Then commit the merge (`git commit --no-edit`). The merge commit and the
reconciliation are **separate commits** — keep them apart for auditability.

Sanity math: `files-in-merge-commit ≈ upstream_changed − already-deleted-locales −
protected-both-changed-kept-ours`. If it doesn't add up, investigate.

---

## Phase 6 — Reconcile `merge=ours` both-changed files (the manual cherry-pick)

For **each** both-changed protected file, graft upstream's safe changes onto our
version. The workhorse is a clean-apply test:

```bash
BASE=$(cat /tmp/base_sha.txt)
git diff "$BASE" upstream/main -- "$FILE" > /tmp/f.patch
git apply --check /tmp/f.patch && git apply /tmp/f.patch && echo "applied cleanly"
```

**If it applies cleanly**, Rocky's customizations live *outside* the changed hunks —
safe to apply, then verify Rocky code survived with `grep` (markers, vf logic,
wishlist refs, etc.). **If it doesn't apply cleanly**, Rocky edited the same region —
hand-reconcile, reading both `git diff $BASE upstream/main -- $FILE` and our version.

After every file: confirm `{%- # r: -%}` markers and Rocky logic are intact.

### What "safe to apply" looks like (learned in v3.5.1)

- **Relocated styles — ALWAYS apply.** Upstream periodically extracts inline CSS
  into a new `*-styles.liquid` snippet or swaps an inline element for a
  `*-component` snippet (e.g. `_product-card.liquid` rendering `buy-buttons-styles`,
  `quick-add-styles`, …; `cart-summary.liquid` → `accordion-custom-component`;
  `header-actions.liquid` → `cart-items-component`). If the kept-ours file doesn't
  render the new snippet, those components render **unstyled / broken**. These
  snippets are pure `{% stylesheet %}` and Shopify **dedupes** their output, so
  rendering them is idempotent.
- **Markup-class coupling — ALWAYS apply.** When upstream's `base.css` (which we
  take wholesale) gains classes, the kept-ours markup that feeds it must emit them.
  v3.5.1: `price.liquid` had to adopt `price__regular` / `price__sale` /
  `price__hidden` because the new `base.css` styles only those classes — the old
  `role="group"` markup left the CSS with no target.
- **Accessibility / docs / a tiny CSS add — apply.** `role="heading"` on card
  titles, doc-comment params, theme-check pragmas, slideshow cursor, version bump.
- **Cosmetic editor defaults in Rocky-rebuilt presets — SKIP and document.**
  v3.5.1: `type_preset: rte → paragraph` had ambiguous mapping across Rocky's
  rebuilt presets and zero storefront impact.

For JSON locale files, prefer `git apply` of the upstream hunk (it slots new keys in
without disturbing Rocky's `rocky.*` / `r_*` keys). Check for dupes first:
`grep -c '"<newkey>"' locales/en.default.json`.

---

## Phase 7 — Verify reconciliation

**JSONC-aware JSON validation** (Shopify files are JSONC — leading `/* */` block +
`//` line comments; strict `json.load` will falsely fail):

```python
import json, re, glob
def strip_jsonc(s):
    if s.lstrip().startswith('/*'): s = s[s.find('*/')+2:]   # leading block comment
    s = re.sub(r'(^|\s)//[^\n]*', r'\1', s)                  # // line comments
    s = re.sub(r',(\s*[}\]])', r'\1', s)                     # trailing commas
    return s
for f in glob.glob('templates/*.json') + glob.glob('config/*.json') + glob.glob('locales/en.default*.json'):
    json.loads(strip_jsonc(open(f).read()))   # raises on real breakage only
```

**theme-check — compare BASELINE, never absolute counts:**

```bash
shopify theme check --fail-level error 2>&1 | grep -oE '\[error\]: [A-Za-z]+' | sort | uniq -c | sort -rn
```

Run it on pre-merge `main` and on the staging branch and **diff the per-type
counts**. `ValidSchemaTranslations` (~3800) and `TranslationKeyExists` (~160) are
**pre-existing false positives** — the keys exist; Shopify's runtime resolves them
(see memory `theme-check-schema-translation-false-positives`). Only
`LiquidHTMLSyntaxError`, `MissingAsset`, `ValidSchema` are actionable, and in this
repo even those are all inside `apps/` (app-extension files theme-check incidentally
lints), not the Horizon theme. A merge that adds **zero** real-error-type counts and
touches **zero** `r-*` files is good.

---

## Phase 8 — Promote to main

```bash
git checkout main
git merge --ff-only horizon-update-...   # fast-forward; main hasn't diverged
```

- The staging branch was cut from `main`, so this is a **fast-forward** — no merge commit.
- **Do not push.** State that `main` is ahead of `origin/main` by N commits and stop.
  Push only on explicit user request (`git push origin main`).
- Keep the staging branch as a backup until the user confirms; delete with
  `git branch -d horizon-update-...` afterward.

---

## Key learnings / gotchas (read every time)

1. **`merge=ours` fires only on BOTH-sided changes.** A protected file that *only
   upstream* changed takes upstream's version (no conflict, driver not invoked).
   Only files changed on both sides keep ours. That is why Phase 2 splits the set.

2. **The unregistered-customization trap.** A file Rocky edited but never added to
   `.gitattributes merge=ours` gets a silent 3-way merge → Rocky code can vanish.
   The Phase-2 danger check is mandatory.

3. **Locales are English + French only.** Rocky deletes every other `locales/*.json`.
   Upstream edits them → `DU` modify/delete conflicts → `git rm` (keep deleted).

4. **Shopify JSON is JSONC.** Templates/config carry a leading `/* … */` block;
   locale files carry `//` line comments. `json.load` falsely reports "invalid".
   Always strip comments before validating; never "fix" a file over this.

5. **theme-check translation errors are noise.** ~3800 `ValidSchemaTranslations`
   reference keys that actually exist. Compare baseline counts by type; don't read
   the absolute number as breakage.

6. **Relocated styles silently break components.** Watch for upstream adding
   `{% render '*-styles' %}` calls or swapping inline elements for `*-component`
   snippets. Kept-ours files must adopt them or sub-components render unstyled.

7. **base.css couples to kept-ours markup.** We take `base.css` wholesale; if it
   gains classes, the kept-ours Liquid that should emit them must be updated
   (the `price.liquid` lesson).

8. **Multi-line `{%- # … -%}` comments need `#` on EVERY line.** Shopify's *upload
   validator* throws `Syntax error in tag '#'` — and **theme-check does NOT catch
   it locally**. Keep `# r:` markers single-line; use `{% comment %}` for long notes.

9. **Deleted upstream blocks linger on the remote theme.** When upstream deletes a
   block (e.g. `blocks/_media.liquid`), the local merge removes it but the **remote
   dev/live theme keeps the stale, now-schema-less file** → "Tag 'schema' is
   missing" on the next upload. Fix: a full `shopify theme push` (deletes absent
   files) or delete it in the admin code editor. Verify locally first: the file is
   gone from HEAD *and* nothing references the block (`grep -rn '"_media"'`).

10. **`git add -A` sweeps up editor auto-format noise.** Format-on-save can silently
    mutate files between your edit and the commit (it once broke a `# r:` marker and
    added trailing whitespace). Review `git show --stat HEAD` / the diff before
    finalizing; restore anything you didn't intend.

11. **`cart-items-component` morph gotcha.** It lives in the header section; a
    `cart:update` morphs the whole header. Anything dynamic (wishlist) needs
    `data-skip-subtree-update`. The inline→snippet refactor preserves the same
    element + attributes (`class`, `data-drawer`, `data-section-id`), so morph
    behavior is unchanged — but verify the new snippet emits them.

12. **Keep merge and reconciliation as separate commits.** The merge commit should
    be a pure upstream merge; the reconciliation is its own commit with a per-file
    rationale (including what you deliberately skipped). This makes the next
    upstream audit trivial.

---

## Best-practices checklist

- [ ] `merge.ours.driver` = `true` and working tree clean before starting
- [ ] Fetched `upstream`; identified the target version
- [ ] Categorized the changed set (both-changed vs upstream-only vs danger)
- [ ] Merged on a **staging branch**, never `main`
- [ ] Locale modify/deletes resolved as `git rm`; `release-notes.md` hand-merged
- [ ] Verified: protected both-changed kept ours, **zero `r-*` touched**, no conflict markers
- [ ] Reconciled each both-changed protected file; Rocky markers + logic verified intact
- [ ] Applied relocated-styles + markup-class changes; skipped/documented cosmetics
- [ ] JSONC-aware validation passes; theme-check baseline shows no new real errors
- [ ] `.gitattributes` + `.cursor/references/gitattributes-merge-strategy.md` updated for any newly-customized files
- [ ] Promoted with `--ff-only`; **did not push**; told the user to test on a preview theme

---

## References

- `CLAUDE.md` → **Upstream Update Protocol**, **Architecture-critical surfaces**,
  **Modifying an Upstream File** (Path A / Path B)
- `.cursor/references/gitattributes-merge-strategy.md` — the `merge=ours` registry
- Memory: `theme-check-schema-translation-false-positives`,
  `horizon-cart-events-not-customevent`
- Worked example: the **Horizon v3.5.1** merge (221 files; 17 reconciled protected
  files; 47 locale modify/deletes kept-deleted).
