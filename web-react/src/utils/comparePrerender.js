// The build writes static HTML for /compare and /compare/<slug>
// (scripts/prerender-compare.js). That copy lives in a sibling of #root with
// this id so it stays on screen while the SPA boots, then is removed once
// React renders the real page (or the signed-in app takes over instead).
export const COMPARE_PRERENDER_ID = 'compare-prerender';

export function removeComparePrerender() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(COMPARE_PRERENDER_ID);
  if (el) el.remove();
}
