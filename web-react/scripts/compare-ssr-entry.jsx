// Server-render entry for scripts/prerender-compare.js. Renders the same
// Compare component the SPA uses, so the static HTML matches what React draws.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router-dom';
import Compare from '../src/pages/Compare.jsx';

export function render(url) {
  return renderToStaticMarkup(
    <StaticRouter location={url}>
      <Routes>
        <Route path="/compare" element={<Compare />} />
        <Route path="/compare/:slug" element={<Compare />} />
      </Routes>
    </StaticRouter>
  );
}
