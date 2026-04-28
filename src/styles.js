"use strict";

function injectStyles() {
  const s = document.createElement("style");
  s.textContent = `
    #imdb-ms-panel, #imdb-ms-panel *, #imdb-ms-toasts, #imdb-ms-toasts * {
        font-family: var(--ipt-font-family) !important;
    }
    .imdb-ms-lbl { font-family: var(--ipt-font-family) !important; }
    @keyframes imdb-ms-shimmer {
        0%   { background-position: 150% 50%; }
        100% { background-position: -50% 50%; }
    }
  `;
  document.head.appendChild(s);
}

module.exports = { injectStyles };
