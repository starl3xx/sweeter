// Icons: Apple’s SF Symbols (Sweeter.SYMBOLS, generated from macOS by
// scripts/sf-symbols.swift), inlined per use so they render the same inside
// a shadow root on every Safari version. They fill with currentColor.
(function (root) {
  'use strict';
  const Sweeter = root.Sweeter || (root.Sweeter = {});

  // SF Symbols has no GIF symbol, so this one stays a text label.
  const GIF = '<g fill="none" stroke="currentColor" stroke-width="2.6"><rect x="6.5" y="10" width="31" height="24" rx="5"/></g><text x="22" y="27.2" text-anchor="middle" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="12.5" font-weight="700" fill="currentColor">GIF</text>';
  // The verified seal’s checkmark is a cut-out; a white disc behind it
  // makes the check white on any background, as X draws it.
  const SEAL_UNDER = '<circle cx="22" cy="22" r="11" fill="#fff"/>';

  Sweeter.icon = function icon(name, cls) {
    const box = Sweeter.SYMBOL_BOX || 44;
    const d = Sweeter.SYMBOLS && Sweeter.SYMBOLS[name];
    const body = d ? (name === 'seal' ? SEAL_UNDER : '') + '<path d="' + d + '"/>' : name === 'gif' ? GIF : '';
    return '<svg viewBox="0 0 ' + box + ' ' + box + '" fill="currentColor" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + body + '</svg>';
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
