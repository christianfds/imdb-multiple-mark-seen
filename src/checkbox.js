"use strict";

const { extractTitleId } = require("./dom");
const { watchedSet } = require("./state");
const { detectWatchedInDOM, applyWatchedToCheckbox } = require("./watched");
const { updateCounter } = require("./counter");

function injectCheckbox(container) {
  if (container.dataset.imdbMsAdded) return;
  const titleId = extractTitleId(container);
  if (!titleId) return;

  container.dataset.imdbMsAdded = "true";
  container.dataset.imdbTitleId = titleId;

  const wrap = document.createElement("label");
  Object.assign(wrap.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    userSelect: "none",
    padding: "4px 6px",
    margin: "4px 0",
  });

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.dataset.titleId = titleId;
  Object.assign(cb.style, {
    width: "18px",
    height: "18px",
    accentColor: "#f5c518",
    cursor: "pointer",
    flexShrink: "0",
  });
  cb.addEventListener("change", updateCounter);

  const lbl = document.createElement("span");
  lbl.className = "imdb-ms-lbl";
  lbl.textContent = "Mark as seen";
  Object.assign(lbl.style, {
    fontSize: "12px",
    color: "#aaa",
    whiteSpace: "nowrap",
  });

  wrap.appendChild(cb);
  wrap.appendChild(lbl);

  const img = container.querySelector("img");
  const anchor = img ? img.closest("a") || img : null;
  if (anchor && anchor.parentElement === container) {
    container.insertBefore(wrap, anchor.nextSibling);
  } else {
    container.insertBefore(wrap, container.firstChild);
  }

  // 1. Restore from in-memory set (handles React re-renders after we've already
  //    determined the watched state once).
  if (watchedSet.has(titleId)) {
    console.log(`[IMDB-MS] injectCheckbox: restoring watched state for ${titleId} from watchedSet`);
    applyWatchedToCheckbox(cb);
    return;
  }

  // 2. Read IMDB's own rendered check-in button state.
  if (detectWatchedInDOM(container, titleId)) {
    watchedSet.add(titleId);
    applyWatchedToCheckbox(cb);
    return;
  }

  // 3. Watched state not yet known — disable until the prefetch resolves.
  cb.disabled = true;
  cb.dataset.loading = "true";
  lbl.textContent = "Loading…";
  lbl.style.color = "#555";
}

module.exports = { injectCheckbox };
