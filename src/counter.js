"use strict";

const { getSeasonCheckboxes, getSelectableCheckboxes } = require("./dom");

function updateCounter() {
  const badge = document.getElementById("imdb-ms-counter");
  if (!badge) return;
  const all = getSeasonCheckboxes();
  if (all.some((cb) => cb.dataset.loading === "true")) {
    badge.textContent = "Loading…";
    badge.style.color = "#888";
    return;
  }
  const selectable = getSelectableCheckboxes();
  const checked = selectable.filter((cb) => cb.checked).length;
  badge.textContent = `${checked} of ${selectable.length} selected`;
  badge.style.color = checked > 0 ? "#f5c518" : "#888";
}

module.exports = { updateCounter };
