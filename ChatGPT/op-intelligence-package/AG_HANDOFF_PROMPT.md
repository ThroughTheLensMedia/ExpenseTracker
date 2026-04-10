# AG Handoff Prompt — Operational Intelligence Section

Implement the Operational Intelligence section rebuild using the attached specs.

## Scope
Only work on this section.
Do not refactor unrelated dashboard areas in the same pass.

## Required Changes
- remove the current top row of large vendor cards
- replace that area with a compact summary control panel
- add an action strip with one-click filters for review, duplicate, and unused
- add a compact top offenders snapshot
- keep the recurring vendors table as the primary analysis surface

## Files to Use
- `OP_INTELLIGENCE_SECTION.md`
- `COMPONENT_MAP.md`
- `IMPLEMENTATION_NOTES.md`

## Build Priorities
1. information hierarchy
2. compact layout
3. scan speed
4. filter usability
5. visual consistency with the rest of the product

## Constraints
- no decorative vendor cards
- no redundant labels
- no bloated badge stacks
- do not add trend charts in this pass
- do not build cancellation workflows in this pass

## Deliverable
Return:
- updated section implementation
- any new components used for the section
- note of files changed
- brief explanation of data derivations used
