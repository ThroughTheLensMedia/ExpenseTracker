# Lumière Ledger — Project Instructions for Claude

**Read `SPEC.md` before touching any file in this project.**
It contains the architecture, file map, data patterns, engineering standards, and acceptance criteria.

---

## Non-Negotiable Rules

1. **Update `CHANGELOG.md` on every change** — version number, date, and plain-English description of what changed and why. No exceptions. No silent commits.
2. **Update `SPEC.md`** if the architecture, file map, tech stack, data patterns, or acceptance criteria change.
3. **Only modify files in scope** — do not rewrite unrelated files.
4. **Never guess** — if something is unclear, ask.
5. **One file per response, max 500 lines** — if output is truncated, wait for "CONTINUE".
6. **Preserve existing working logic** — do not refactor what isn't broken unless explicitly asked.

## Key Files

| File | Purpose |
|------|---------|
| `SPEC.md` | Master engineering spec — read this first |
| `CHANGELOG.md` | Version history — update on every change |
| `ROADMAP.md` | Product roadmap with active sprint priorities |
| `REBRAND_ROADMAP.md` | Domain migration plan (app.throughthelens.media → lumiereledger.com) |
| `FIX_ROADMAP.md` | Tactical fix tracking across all phases |
| `LAUNCH_FIXES.md` | Security hardening checklist |

## Current Version
**v7.2.0** — see `CHANGELOG.md` for full history.

## Deploy
`git push origin main` → Vercel auto-deploys. No manual build step.

## Owner
Joshua Deuermeyer — Through The Lens Media, Las Vegas NV.
Professional photographer/videographer. FAA Part 107. 9 years experience. Treat as a peer.
