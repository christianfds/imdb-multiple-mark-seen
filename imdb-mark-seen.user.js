// ==UserScript==
// @name         IMDB Mark Episodes as Seen
// @namespace    https://github.com/christianfds/imdb-multiple-mark-seen
// @version      1.7.0
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

(function () {
  "use strict";

  const GRAPHQL_URL = "https://api.graphql.imdb.com/";

  const ADD_MUTATION = `mutation AddWatchedTitle($titleId: ID!) {
  addWatchedTitle(titleId: $titleId) {
    message { language value }
    success
  }
}`;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function getCookie(name) {
    const m = document.cookie.match(
      new RegExp(
        "(?:^|; )" +
          name.replace(/[.*+?^=!:${}()|[\]/\\]/g, "\\$1") +
          "=([^;]*)",
      ),
    );
    return m ? decodeURIComponent(m[1]) : "";
  }

  function randomRid(len = 20) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from(
      { length: len },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  }

  function getShowId() {
    const m = window.location.pathname.match(/\/title\/(tt\d+)/);
    return m ? m[1] : null;
  }

  function gqlHeaders() {
    return {
      accept: "application/graphql+json, application/json",
      "content-type": "application/json",
      origin: "https://www.imdb.com",
      referer: "https://www.imdb.com/",
      "x-amzn-sessionid": getCookie("session-id"),
      "x-imdb-client-name": "imdb-web-next-localized",
      "x-imdb-client-rid": randomRid(),
      "x-imdb-user-country": "US",
      "x-imdb-user-language": "en-US",
    };
  }

  // ─── CSS injection (font fix) ────────────────────────────────────────────────
  // Browsers reset font-family on <button> via UA stylesheet even with inline
  // styles from JS. A <style> tag with inherit !important is the only reliable fix.

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

  // ─── API: mark as watched ────────────────────────────────────────────────────

  function markAsWatched(titleId) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: GRAPHQL_URL,
        withCredentials: true,
        headers: gqlHeaders(),
        data: JSON.stringify({
          query: ADD_MUTATION,
          operationName: "AddWatchedTitle",
          variables: { titleId },
        }),
        onload(res) {
          try {
            const body = JSON.parse(res.responseText);
            if (body?.data?.addWatchedTitle?.success) {
              resolve(titleId);
            } else {
              reject(
                new Error(body?.errors?.[0]?.message || "API returned failure"),
              );
            }
          } catch (e) {
            reject(e);
          }
        },
        onerror() {
          reject(new Error("Network error"));
        },
      });
    });
  }

  // ─── API: prefetch watched status ────────────────────────────────────────────
  // PersonalizedTitlesData returns userWatchedStatus.isWatched — this is the
  // actual "Seen" history written by addWatchedTitle, not the Watchlist.

  const PERSONALIZED_HASH =
    "a746c4218025e024a8899cd06927c73b311178c2a51ef64bbd3a87fc7b6268cd";

  function prefetchWatchedStatus(titleIds) {
    console.log("[IMDB-MS] prefetchWatchedStatus called with", titleIds);
    if (!titleIds.length) {
      console.warn("[IMDB-MS] prefetchWatchedStatus: no IDs, skipping");
      return Promise.resolve({});
    }

    const variables = encodeURIComponent(
      JSON.stringify({ idArray: titleIds, locale: "en-US" }),
    );
    const extensions = encodeURIComponent(
      JSON.stringify({
        persistedQuery: { sha256Hash: PERSONALIZED_HASH, version: 1 },
      }),
    );
    const url =
      `${GRAPHQL_URL}?operationName=PersonalizedTitlesData` +
      `&variables=${variables}&extensions=${extensions}`;

    console.log("[IMDB-MS] prefetch GET →", url);

    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        withCredentials: true,
        headers: gqlHeaders(),
        onload(res) {
          console.log("[IMDB-MS] prefetch response status:", res.status);
          console.log("[IMDB-MS] prefetch raw response:", res.responseText);
          try {
            const body = JSON.parse(res.responseText);
            console.log("[IMDB-MS] prefetch parsed body:", body);
            const titles = body?.data?.titles ?? [];
            const result = {};
            for (const title of titles) {
              if (title?.id) {
                result[title.id] = Boolean(title.userWatchedStatus?.isWatched);
              }
            }
            console.log("[IMDB-MS] prefetch resolved map:", result);
            resolve(result);
          } catch (e) {
            console.error("[IMDB-MS] prefetch parse error:", e);
            resolve({});
          }
        },
        onerror(e) {
          console.error("[IMDB-MS] prefetch network error:", e);
          resolve({});
        },
      });
    });
  }

  // ─── Toast system ────────────────────────────────────────────────────────────

  function ensureToastContainer() {
    let c = document.getElementById("imdb-ms-toasts");
    if (!c) {
      c = document.createElement("div");
      c.id = "imdb-ms-toasts";
      Object.assign(c.style, {
        position: "fixed",
        bottom: "20px",
        left: "20px",
        zIndex: "2147483647",
        display: "flex",
        flexDirection: "column-reverse",
        gap: "10px",
        maxWidth: "360px",
        pointerEvents: "none",
      });
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(html, type = "success", persistent = false) {
    const container = ensureToastContainer();
    const bg =
      type === "success" ? "#2e7d32" : type === "error" ? "#b71c1c" : "#1a237e";
    const icon = type === "success" ? "✓" : type === "error" ? "✗" : "ℹ";

    const toast = document.createElement("div");
    Object.assign(toast.style, {
      position: "relative",
      background: bg,
      color: "#fff",
      padding: "11px 36px 11px 14px",
      borderRadius: "8px",
      boxShadow: "0 4px 16px rgba(0,0,0,.45)",
      fontSize: "13px",
      lineHeight: "1.5",
      opacity: "1",
      transition: "opacity .4s ease",
      pointerEvents: "auto",
      wordBreak: "break-word",
    });
    toast.innerHTML = `<strong>${icon}</strong> ${html}`;

    const x = document.createElement("button");
    x.textContent = "✕";
    Object.assign(x.style, {
      position: "absolute",
      top: "6px",
      right: "8px",
      background: "none",
      border: "none",
      color: "#fff",
      cursor: "pointer",
      fontSize: "13px",
      lineHeight: "1",
      padding: "2px 4px",
    });
    x.onclick = () => fadeOut(toast);
    toast.appendChild(x);
    container.appendChild(toast);

    if (!persistent) setTimeout(() => fadeOut(toast), 4500);
    return toast;
  }

  function fadeOut(el) {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 450);
  }

  // ─── DOM: season-scoped helpers ──────────────────────────────────────────────

  function getSeasonListRoot() {
    // Only selectors that identify the FULL season episode list.
    // "episodes-widget" is intentionally excluded — it is the top-rated/most-recent
    // sidebar widget, not the season list.
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

    // When using the fallback, explicitly exclude IMDB's sidebar widgets that
    // also contain episode tt links (top-rated, most-recent, etc.).
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
        // Skip links that live inside any excluded widget
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

  // ─── Counter ─────────────────────────────────────────────────────────────────

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

  // ─── DOM: inject checkboxes ──────────────────────────────────────────────────

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

  // Scans the episode card for IMDB's own watched/check-in indicator.
  // Logs every button with aria-pressed so we can identify the right selector.
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

    // Match any button whose test-id or label references check-in / seen / watched
    // and whose aria-pressed is "true".
    return buttons.some(
      (b) =>
        b.getAttribute("aria-pressed") === "true" &&
        /check|seen|watched|history/i.test(
          (b.dataset.testid || "") + (b.getAttribute("aria-label") || ""),
        ),
    );
  }

  // ─── Watched state — persistent across React re-renders ─────────────────────
  // IMDB's React re-renders episode cards after we inject checkboxes, wiping our
  // DOM changes. We keep an in-memory Set so every injectCheckbox call can
  // immediately restore the watched state without waiting for the network again.

  const watchedSet = new Set();

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

      watchedSet.add(titleId); // persist so re-injected checkboxes pick it up
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

  // ─── DOM: floating controls ──────────────────────────────────────────────────

  function injectControls() {
    if (document.getElementById("imdb-ms-panel")) return;

    const panel = document.createElement("div");
    panel.id = "imdb-ms-panel";
    Object.assign(panel.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "2147483646",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      alignItems: "flex-end",
    });

    // ── Counter badge ──
    const badge = document.createElement("div");
    badge.id = "imdb-ms-counter";
    Object.assign(badge.style, {
      fontSize: "12px",
      fontWeight: "600",
      color: "#888",
      textAlign: "right",
      padding: "0 4px",
    });
    badge.textContent = "0 of 0 selected";

    // ── Select All / Deselect All ──
    const selBtn = document.createElement("button");
    selBtn.id = "imdb-ms-selall";
    selBtn.textContent = "Select All";
    styleBtn(selBtn, "#333", "#fff");

    let allSel = false;
    selBtn.onclick = () => {
      allSel = !allSel;
      // Only touch selectable (non-watched) episodes.
      getSelectableCheckboxes().forEach((cb) => {
        cb.checked = allSel;
      });
      selBtn.textContent = allSel ? "Deselect All" : "Select All";
      updateCounter();
    };

    // ── Mark as Seen ──
    const markBtn = document.createElement("button");
    markBtn.id = "imdb-ms-mark";
    markBtn.textContent = "★  Mark Checked as Seen";
    styleBtn(markBtn, "#f5c518", "#000");
    markBtn.onmouseenter = () => {
      markBtn.style.background = "#e6b800";
    };
    markBtn.onmouseleave = () => {
      markBtn.style.background = "#f5c518";
    };

    markBtn.onclick = async () => {
      const checked = getSeasonCheckboxes().filter((cb) => cb.checked);
      if (!checked.length) {
        showToast(
          "No episodes selected — tick some checkboxes first.",
          "info",
          false,
        );
        return;
      }

      markBtn.disabled = true;

      const ids = checked.map((cb) => cb.dataset.titleId);
      const ok = [], fail = [];
      const progress = attachButtonProgress(markBtn, ids.length);

      await Promise.all(
        ids.map((id) =>
          markAsWatched(id)
            .then(() => { ok.push(id);   progress.advance(true);  })
            .catch(() => { fail.push(id); progress.advance(false); }),
        ),
      );

      markBtn.disabled = false;
      progress.finish(fail.length > 0);

      if (!fail.length) {
        checked.forEach((cb) => {
          watchedSet.add(cb.dataset.titleId); // persist so re-renders restore state
          applyWatchedToCheckbox(cb);
        });
        updateCounter();
        showToast(`${ok.length} episode(s) marked as seen!`, "success", false);
      } else {
        const lines = [];
        if (ok.length) lines.push(`${ok.length} marked successfully.`);
        lines.push(`${fail.length} failed (${fail.join(", ")}).`);
        lines.push("Are you logged in to IMDB?");
        showToast(lines.join("<br>"), "error", true);
        updateCounter();
      }
    };

    panel.appendChild(badge);
    panel.appendChild(selBtn);
    panel.appendChild(markBtn);
    document.body.appendChild(panel);

    updateCounter();
  }

  // ─── In-button progress ───────────────────────────────────────────────────────
  // Turns the Mark button itself into a progress indicator: a fill overlay grows
  // left-to-right as each parallel request settles. No extra DOM elements needed.

  function attachButtonProgress(btn, total) {
    // Preserve original appearance so we can restore it later
    const origText  = btn.textContent;
    const origBg    = btn.style.background;
    const origColor = btn.style.color;

    // Make the button a positioning context and give it a dark base
    btn.style.position = "relative";
    btn.style.overflow = "hidden";
    btn.style.background = "#2a2a2a";
    btn.style.color = "#fff";

    // Fill layer — grows behind the label text
    const fill = document.createElement("div");
    Object.assign(fill.style, {
      position: "absolute", top: "0", left: "0",
      height: "100%", width: "0%",
      background: "linear-gradient(90deg, #2e7d32 30%, #4caf50 50%, #2e7d32 70%)",
      backgroundSize: "200% 100%",
      animation: "imdb-ms-shimmer 1.4s linear infinite",
      transition: "width .1s ease",
      borderRadius: "inherit",
      pointerEvents: "none",
      zIndex: "0",
    });

    // Text layer — floats above the fill
    const label = document.createElement("span");
    Object.assign(label.style, {
      position: "relative", zIndex: "1",
    });
    label.textContent = `0 / ${total}`;

    btn.innerHTML = "";
    btn.appendChild(fill);
    btn.appendChild(label);

    let done = 0, failed = 0;
    const queue = [];
    let draining = false;
    let onDrained = null;

    function drainNext() {
      if (!queue.length) {
        draining = false;
        if (onDrained) { const cb = onDrained; onDrained = null; cb(); }
        return;
      }
      draining = true;
      const { d, f } = queue.shift();
      fill.style.width = `${(d / total) * 100}%`;
      if (f > 0) {
        fill.style.background = "linear-gradient(90deg, #b71c1c 30%, #d32f2f 50%, #b71c1c 70%)";
      }
      label.textContent = `${d} / ${total}`;
      setTimeout(drainNext, 150);
    }

    return {
      advance(success) {
        done++;
        if (!success) failed++;
        queue.push({ d: done, f: failed });
        if (!draining) drainNext();
      },
      finish(hadFailures) {
        const doFinish = () => {
          fill.style.width = "100%";
          fill.style.animation = "none";
          fill.style.backgroundSize = "";
          fill.style.background = hadFailures ? "#b71c1c" : "#2e7d32";
          label.textContent = hadFailures
            ? `${done - failed} ok · ${failed} failed`
            : `✓ ${done} marked`;
          setTimeout(() => {
            btn.innerHTML = origText;
            btn.style.background = origBg;
            btn.style.color = origColor;
            btn.style.overflow = "";
          }, hadFailures ? 3000 : 1500);
        };
        if (draining || queue.length) {
          onDrained = doFinish;
        } else {
          doFinish();
        }
      },
    };
  }

  function styleBtn(btn, bg, color) {
    Object.assign(btn.style, {
      background: bg,
      color,
      border: "none",
      borderRadius: "8px",
      padding: "10px 18px",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "pointer",
      boxShadow: "0 4px 14px rgba(0,0,0,.35)",
      transition: "background .15s",
      whiteSpace: "nowrap",
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  function run() {
    const containers = findEpisodeContainers();
    console.log(`[IMDB-MS] run(): found ${containers.length} episode containers`);
    if (!containers.length) return false;

    containers.forEach(injectCheckbox);
    injectControls();

    const ids = containers.map((c) => c.dataset.imdbTitleId).filter(Boolean);
    console.log("[IMDB-MS] run(): episode IDs to prefetch:", ids);
    prefetchWatchedStatus(ids).then((map) => {
      applyWatchedStatuses(map);
      enablePendingCheckboxes();
    });

    return true;
  }

  // After bootstrap, watch for SPA season navigation adding new episode cards
  function watchForNewEpisodes() {
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
      prefetchWatchedStatus(ids).then((map) => {
        applyWatchedStatuses(map);
        enablePendingCheckboxes();
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Test exports / Browser init ─────────────────────────────────────────────

  if (typeof module !== "undefined") {
    // Node / Jest: export internals for testing, skip all DOM init.
    module.exports = {
      getCookie, randomRid, getShowId,
      looksLikeEpisodeCard, extractTitleId, detectWatchedInDOM,
      getSeasonListRoot, findEpisodeContainers,
      getSeasonCheckboxes, getSelectableCheckboxes,
      applyWatchedToCheckbox, applyWatchedStatuses,
      enablePendingCheckboxes, updateCounter,
      injectCheckbox, injectControls,
      prefetchWatchedStatus, markAsWatched,
      attachButtonProgress, watchedSet,
    };
  } else {
    // Browser: run normally.
    injectStyles();

    let bootstrapped = false;
    function tryBootstrap() {
      if (bootstrapped) return;
      console.log("[IMDB-MS] tryBootstrap attempt");
      if (!run()) {
        console.log("[IMDB-MS] tryBootstrap: no containers yet, will retry");
        return;
      }
      bootstrapped = true;
      console.log("[IMDB-MS] bootstrapped successfully");
      watchForNewEpisodes();
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
  }
})();
