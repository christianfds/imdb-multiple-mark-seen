// ==UserScript==
// @name         IMDB Mark Episodes as Seen
// @namespace    https://github.com/christianfds/imdb-multiple-mark-seen
// @version      1.8.0
// @description  Add checkboxes to IMDB season episodes and bulk-mark them as watched
// @author       christianfds
// @homepageURL  https://github.com/christianfds/imdb-multiple-mark-seen
// @downloadURL  https://github.com/christianfds/imdb-multiple-mark-seen/releases/latest/download/imdb-mark-seen.user.js
// @updateURL    https://github.com/christianfds/imdb-multiple-mark-seen/releases/latest/download/imdb-mark-seen.user.js
// @match        https://www.imdb.com/title/*/episodes*
// @grant        GM_xmlhttpRequest
// @connect      api.graphql.imdb.com
// @run-at       document-idle
// ==/UserScript==

"use strict";

const { injectStyles } = require("./ui/styles");
const { createApi } = require("./api/api");
const { run, watchForNewEpisodes } = require("./dom/init");

// GM_xmlhttpRequest is provided by Tampermonkey at runtime via @grant.
const api = createApi(GM_xmlhttpRequest); // eslint-disable-line no-undef

injectStyles();

let bootstrapped = false;
function tryBootstrap() {
  if (bootstrapped) return;
  console.log("[IMDB-MS] tryBootstrap attempt");
  if (!run(api)) {
    console.log("[IMDB-MS] tryBootstrap: no containers yet, will retry");
    return;
  }
  bootstrapped = true;
  console.log("[IMDB-MS] bootstrapped successfully");
  watchForNewEpisodes(api);
}

tryBootstrap();

if (!bootstrapped) {
  console.log("[IMDB-MS] waiting for DOM via MutationObserver…");
  const initObs = new MutationObserver(tryBootstrap);
  initObs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => {
    initObs.disconnect();
    console.warn("[IMDB-MS] init observer timed out after 60s");
  }, 60_000);
}
