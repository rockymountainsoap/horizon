# ⚰️ SUPERSEDED (2026-07) — Do Not Extend This File

The `merge=ours` registry and whole-tree upstream merge strategy documented here were
**retired by WS7** (ownership-tier model). This file is kept only so old links and
muscle memory land on a pointer.

- **Why retired:** the repo is Rocky-owned by default; upstream sync is limited to a
  14-file engine manifest. The registry also silently suppressed conflicts on normal
  feature-branch merges/rebases. Full rationale: `.cursor/plans/WS7-frontend-rework-adr.md`.
- **Replacement registry:** `.cursor/references/engine-manifest.md`
- **Replacement workflow:** `.claude/skills/engine-sync/SKILL.md`
- **Historical content:** `git log -p -- .cursor/references/gitattributes-merge-strategy.md`

Do not add new entries here, and do not re-add `merge=ours` lines to `.gitattributes`.
