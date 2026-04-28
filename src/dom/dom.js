"use strict";

const { getShowId } = require("../core/utils");

function getSeasonListRoot() {
  const candidates = [
    '[data-testid="episodes-browse-episodes"]',
    '[data-testid="episode-list"]',
    '[data-testid="episodes-card-container"]',
    '[data-testid="EpisodesCardContainer"]',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) {
      console.log(`[IMDB-MS] getSeasonListRoot matched: ${sel}`);
      return el;
    }
  }
  console.warn("[IMDB-MS] getSeasonListRoot: no specific container found, will use <main> + exclusions");
  return null;
}

// Returns true only for containers that look like episode cards.
// Episode cards always show a season/episode number ("S1.E2") in their text,
// or carry a data-testid that references "episode". This filters out
// unrelated tt links (cast pages, "More like this", sidebar, etc.).
function looksLikeEpisodeCard(el) {
  if (/S\d+\.E\d+/i.test(el.textContent)) return true;
  if (/\bE\d+\b/.test(el.textContent) && el.querySelector('a[href*="/title/tt"]')) return true;
  if ((el.dataset?.testid || "").toLowerCase().includes("episode")) return true;
  if (el.querySelector('[data-testid*="episode"]')) return true;
  return false;
}

// All checkboxes inside the current season list (watched + unwatched).
function getSeasonCheckboxes() {
  const root = getSeasonListRoot() || document.body;
  return Array.from(root.querySelectorAll("input[data-title-id]"));
}

// Only the episodes that are ready and unwatched — excludes watched episodes
// and those still waiting on the prefetch response.
function getSelectableCheckboxes() {
  return getSeasonCheckboxes().filter(
    (cb) => cb.dataset.watched !== "true" && cb.dataset.loading !== "true",
  );
}

function isInTopRatedSection(element) {
  let el = element.parentElement;
  while (el && el !== document.body) {
    const tid = (el.dataset?.testid || "").toLowerCase();
    if (tid.includes("top") && tid.includes("rated")) return true;
    for (const child of el.children) {
      if (
        /^H[1-4]$/.test(child.tagName) &&
        /top.?rated/i.test(child.textContent)
      )
        return true;
    }
    const prev = el.previousElementSibling;
    if (
      prev &&
      /^H[1-4]$/.test(prev.tagName) &&
      /top.?rated/i.test(prev.textContent)
    )
      return true;
    el = el.parentElement;
  }
  return false;
}

function findEpisodeContainers() {
  const showId = getShowId();
  const root = getSeasonListRoot();
  const searchIn = root || document.querySelector("main") || document.documentElement;

  const excludedWidgets = root
    ? []
    : Array.from(document.querySelectorAll(
        '[data-testid="episodes-widget"], [data-testid*="top-rated"], [data-testid*="topRated"]'
      ));

  const seen = new Set();
  const out = [];

  searchIn.querySelectorAll('a[href*="/title/tt"]').forEach((a) => {
    const m = a.href.match(/\/title\/(tt\d+)/);
    if (!m || m[1] === showId) return;

    if (!root) {
      if (excludedWidgets.some((w) => w.contains(a))) return;
      if (isInTopRatedSection(a)) return;
    }

    let el = a;
    while (el && el !== document.body) {
      if (el.tagName === "ARTICLE" || el.tagName === "LI") break;
      el = el.parentElement;
    }
    if (!el || el === document.body) el = a.parentElement;

    if (!root && !looksLikeEpisodeCard(el)) {
      console.log("[IMDB-MS] skipping non-episode container:", el?.dataset?.testid, el?.textContent?.slice(0, 60));
      return;
    }

    if (el && !seen.has(el)) {
      seen.add(el);
      out.push(el);
    }
  });

  return out;
}

function extractTitleId(container) {
  const showId = getShowId();
  for (const a of container.querySelectorAll('a[href*="/title/tt"]')) {
    const m = a.href.match(/\/title\/(tt\d+)/);
    if (m && m[1] !== showId) return m[1];
  }
  return null;
}

module.exports = {
  getSeasonListRoot,
  looksLikeEpisodeCard,
  getSeasonCheckboxes,
  getSelectableCheckboxes,
  findEpisodeContainers,
  extractTitleId,
};
