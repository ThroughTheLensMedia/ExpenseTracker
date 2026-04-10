# Operational Intelligence Package

This package contains the full handoff for rebuilding the Operational Intelligence section only.

## Included Files
- `OP_INTELLIGENCE_SECTION.md` — full section spec
- `COMPONENT_MAP.md` — component-level architecture
- `IMPLEMENTATION_NOTES.md` — execution order and guardrails
- `AG_HANDOFF_PROMPT.md` — direct implementation prompt for AG
- `subscription_example_types.ts` — example types for implementation alignment

## Recommended Usage
1. Give AG the handoff prompt first.
2. Attach the three markdown specs.
3. Ask AG to complete only this section in one pass.
4. Review the returned diff before moving to adjacent dashboard areas.
