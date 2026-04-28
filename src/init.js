"use strict";

const { findEpisodeContainers } = require("./dom");
const { injectCheckbox } = require("./checkbox");
const { injectControls } = require("./controls");
const { applyWatchedStatuses, enablePendingCheckboxes } = require("./watched");
const { updateCounter } = require("./counter");

function run(api) {
  const containers = findEpisodeContainers();
  console.log(`[IMDB-MS] run(): found ${containers.length} episode containers`);
  if (!containers.length) return false;

  containers.forEach(injectCheckbox);
  injectControls(api);

  const ids = containers.map((c) => c.dataset.imdbTitleId).filter(Boolean);
  console.log("[IMDB-MS] run(): episode IDs to prefetch:", ids);
  api.prefetchWatchedStatus(ids).then((map) => {
    applyWatchedStatuses(map);
    enablePendingCheckboxes();
  });

  return true;
}

function watchForNewEpisodes(api) {
  const obs = new MutationObserver(() => {
    const newOnes = findEpisodeContainers().filter(
      (c) => !c.dataset.imdbMsAdded,
    );
    if (!newOnes.length) return;
    console.log(`[IMDB-MS] watchForNewEpisodes: ${newOnes.length} new container(s) detected`);
    newOnes.forEach(injectCheckbox);
    updateCounter();
    const ids = newOnes.map((c) => c.dataset.imdbTitleId).filter(Boolean);
    console.log("[IMDB-MS] watchForNewEpisodes: prefetching IDs:", ids);
    api.prefetchWatchedStatus(ids).then((map) => {
      applyWatchedStatuses(map);
      enablePendingCheckboxes();
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

module.exports = { run, watchForNewEpisodes };
