"use strict";

const { watchedSet } = require("./state");
const { getSeasonCheckboxes } = require("./dom");
const { updateCounter } = require("./counter");

// Scans the episode card for IMDB's own watched/check-in indicator.
function detectWatchedInDOM(container, titleId) {
  const buttons = Array.from(container.querySelectorAll("button"));
  const stateful = buttons.filter(
    (b) => b.getAttribute("aria-pressed") !== null || b.dataset.testid,
  );

  if (stateful.length) {
    console.log(
      `[IMDB-MS] ${titleId} buttons:`,
      stateful.map((b) => ({
        testid: b.dataset.testid || "(none)",
        ariaPressed: b.getAttribute("aria-pressed"),
        ariaLabel: b.getAttribute("aria-label"),
      })),
    );
  } else {
    console.log(`[IMDB-MS] ${titleId}: no stateful buttons found in card`);
  }

  return buttons.some(
    (b) =>
      b.getAttribute("aria-pressed") === "true" &&
      /check|seen|watched|history/i.test(
        (b.dataset.testid || "") + (b.getAttribute("aria-label") || ""),
      ),
  );
}

function applyWatchedToCheckbox(cb) {
  cb.dataset.watched = "true";
  cb.dataset.loading = "";
  cb.checked = false;
  const lbl = cb.closest("label")?.querySelector(".imdb-ms-lbl");
  console.log(`[IMDB-MS] applyWatchedToCheckbox: cb found, lbl found=${!!lbl}`);
  if (lbl) {
    lbl.textContent = "✓ Already seen";
    lbl.style.color = "#4caf50";
  }
}

function applyWatchedStatuses(watchedMap) {
  console.log("[IMDB-MS] applyWatchedStatuses received:", watchedMap);
  const entries = Object.entries(watchedMap);
  if (!entries.length) {
    console.warn("[IMDB-MS] applyWatchedStatuses: empty map — nothing to apply");
    return;
  }

  let anyChange = false;
  for (const [titleId, isWatched] of entries) {
    if (!isWatched) continue;

    watchedSet.add(titleId);
    console.log(`[IMDB-MS] ${titleId} → watched=true, added to watchedSet`);

    const cb = document.querySelector(`input[data-title-id="${titleId}"]`);
    if (!cb) {
      console.warn(`[IMDB-MS] no checkbox in DOM yet for ${titleId} — will apply on next inject`);
      continue;
    }
    applyWatchedToCheckbox(cb);
    anyChange = true;
  }
  if (anyChange) updateCounter();
  else console.log("[IMDB-MS] applyWatchedStatuses: no watched episodes found in DOM this pass");
}

// Enables all checkboxes that were disabled while waiting for the prefetch.
// Called after prefetchWatchedStatus resolves so the user can interact only
// once we know which episodes are already watched.
function enablePendingCheckboxes() {
  getSeasonCheckboxes()
    .filter((cb) => cb.dataset.loading === "true" && cb.dataset.watched !== "true")
    .forEach((cb) => {
      delete cb.dataset.loading;
      cb.disabled = false;
      const lbl = cb.closest("label")?.querySelector(".imdb-ms-lbl");
      if (lbl) { lbl.textContent = "Mark as seen"; lbl.style.color = "#aaa"; }
    });
  updateCounter();
}

module.exports = {
  detectWatchedInDOM,
  applyWatchedToCheckbox,
  applyWatchedStatuses,
  enablePendingCheckboxes,
};
