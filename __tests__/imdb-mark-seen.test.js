"use strict";

const { getCookie, randomRid, getShowId } = require("../src/core/utils");
const { createApi } = require("../src/api/api");
const {
  looksLikeEpisodeCard,
  extractTitleId,
  getSeasonCheckboxes,
  getSelectableCheckboxes,
} = require("../src/dom/dom");
const {
  detectWatchedInDOM,
  applyWatchedToCheckbox,
  applyWatchedStatuses,
  enablePendingCheckboxes,
} = require("../src/dom/watched");
const { updateCounter } = require("../src/dom/counter");
const { attachButtonProgress } = require("../src/ui/progress");
const { watchedSet } = require("../src/core/state");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setPathname(pathname) {
  Object.defineProperty(window, "location", {
    value: { pathname, href: `https://www.imdb.com${pathname}` },
    writable: true,
    configurable: true,
  });
}

function makeCheckbox({
  titleId,
  watched = false,
  loading = false,
  checked = false,
} = {}) {
  const label = document.createElement("label");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.dataset.titleId = titleId;
  cb.checked = checked;
  if (watched) cb.dataset.watched = "true";
  if (loading) {
    cb.dataset.loading = "true";
    cb.disabled = true;
  }
  const span = document.createElement("span");
  span.className = "imdb-ms-lbl";
  span.textContent = loading
    ? "Loading…"
    : watched
      ? "✓ Already seen"
      : "Mark as seen";
  label.appendChild(cb);
  label.appendChild(span);
  document.body.appendChild(label);
  return { cb, span, label };
}

function makeCounter() {
  const badge = document.createElement("div");
  badge.id = "imdb-ms-counter";
  document.body.appendChild(badge);
  return badge;
}

// ─── Reset between tests ──────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = "";
  watchedSet.clear();
  jest.clearAllMocks();
});

// ─── getCookie ────────────────────────────────────────────────────────────────

describe("getCookie", () => {
  test("returns value for an existing cookie", () => {
    Object.defineProperty(document, "cookie", {
      value: "session-id=abc123; other=xyz",
      writable: true,
      configurable: true,
    });
    expect(getCookie("session-id")).toBe("abc123");
  });

  test("returns empty string when cookie is absent", () => {
    Object.defineProperty(document, "cookie", {
      value: "other=xyz",
      writable: true,
      configurable: true,
    });
    expect(getCookie("session-id")).toBe("");
  });

  test("URL-decodes cookie values", () => {
    Object.defineProperty(document, "cookie", {
      value: "token=hello%20world",
      writable: true,
      configurable: true,
    });
    expect(getCookie("token")).toBe("hello world");
  });
});

// ─── randomRid ────────────────────────────────────────────────────────────────

describe("randomRid", () => {
  test("returns a string of length 20 by default", () => {
    expect(randomRid()).toHaveLength(20);
  });

  test("respects a custom length", () => {
    expect(randomRid(8)).toHaveLength(8);
  });

  test("contains only uppercase letters and digits", () => {
    expect(randomRid(100)).toMatch(/^[A-Z0-9]+$/);
  });
});

// ─── getShowId ────────────────────────────────────────────────────────────────

describe("getShowId", () => {
  test("extracts the tt ID from an IMDB episodes URL", () => {
    setPathname("/title/tt1234567/episodes");
    expect(getShowId()).toBe("tt1234567");
  });

  test("returns null for non-title paths", () => {
    setPathname("/name/nm0000354/");
    expect(getShowId()).toBeNull();
  });
});

// ─── looksLikeEpisodeCard ─────────────────────────────────────────────────────

describe("looksLikeEpisodeCard", () => {
  test("returns true when element text contains S1.E2 pattern", () => {
    const el = document.createElement("article");
    el.textContent = "S2.E5 · Some Episode Title";
    expect(looksLikeEpisodeCard(el)).toBe(true);
  });

  test("returns true when element has an episode-related data-testid", () => {
    const el = document.createElement("div");
    el.dataset.testid = "episode-card-container";
    expect(looksLikeEpisodeCard(el)).toBe(true);
  });

  test("returns true when a child has an episode-related data-testid", () => {
    const el = document.createElement("li");
    const inner = document.createElement("div");
    inner.dataset.testid = "episode-item";
    el.appendChild(inner);
    expect(looksLikeEpisodeCard(el)).toBe(true);
  });

  test("returns false for an unrelated element", () => {
    const el = document.createElement("div");
    el.textContent = "Morgan Freeman";
    expect(looksLikeEpisodeCard(el)).toBe(false);
  });
});

// ─── extractTitleId ───────────────────────────────────────────────────────────

describe("extractTitleId", () => {
  beforeEach(() => setPathname("/title/tt0000000/episodes"));

  test("returns the episode tt ID from an anchor inside the container", () => {
    const container = document.createElement("article");
    const a = document.createElement("a");
    a.href = "https://www.imdb.com/title/tt9876543/";
    container.appendChild(a);
    expect(extractTitleId(container)).toBe("tt9876543");
  });

  test("skips links that match the show ID", () => {
    const container = document.createElement("article");
    const a = document.createElement("a");
    a.href = "https://www.imdb.com/title/tt0000000/";
    container.appendChild(a);
    expect(extractTitleId(container)).toBeNull();
  });

  test("returns the first non-show tt ID when multiple links exist", () => {
    const container = document.createElement("article");
    const show = document.createElement("a");
    show.href = "https://www.imdb.com/title/tt0000000/";
    const ep = document.createElement("a");
    ep.href = "https://www.imdb.com/title/tt1111111/";
    container.appendChild(show);
    container.appendChild(ep);
    expect(extractTitleId(container)).toBe("tt1111111");
  });
});

// ─── detectWatchedInDOM ───────────────────────────────────────────────────────

describe("detectWatchedInDOM", () => {
  test("returns true when a check-in button has aria-pressed=true", () => {
    const container = document.createElement("article");
    const btn = document.createElement("button");
    btn.dataset.testid = "episode-check-in";
    btn.setAttribute("aria-pressed", "true");
    container.appendChild(btn);
    expect(detectWatchedInDOM(container, "tt0000001")).toBe(true);
  });

  test("returns false when aria-pressed is false", () => {
    const container = document.createElement("article");
    const btn = document.createElement("button");
    btn.dataset.testid = "episode-check-in";
    btn.setAttribute("aria-pressed", "false");
    container.appendChild(btn);
    expect(detectWatchedInDOM(container, "tt0000001")).toBe(false);
  });

  test("returns false when no relevant buttons exist", () => {
    const container = document.createElement("article");
    expect(detectWatchedInDOM(container, "tt0000001")).toBe(false);
  });
});

// ─── applyWatchedToCheckbox ───────────────────────────────────────────────────

describe("applyWatchedToCheckbox", () => {
  test("sets data-watched, unchecks, and updates the label", () => {
    const { cb, span } = makeCheckbox({ titleId: "tt0000001", checked: true });

    applyWatchedToCheckbox(cb);

    expect(cb.dataset.watched).toBe("true");
    expect(cb.checked).toBe(false);
    expect(span.textContent).toBe("✓ Already seen");
    expect(span.style.color).toBe("rgb(76, 175, 80)");
  });

  test("clears data-loading when applied", () => {
    const { cb } = makeCheckbox({ titleId: "tt0000002", loading: true });
    applyWatchedToCheckbox(cb);
    expect(cb.dataset.loading).toBe("");
  });
});

// ─── applyWatchedStatuses ─────────────────────────────────────────────────────

describe("applyWatchedStatuses", () => {
  test("marks watched episodes and adds them to watchedSet", () => {
    const { cb } = makeCheckbox({ titleId: "tt0000001" });

    applyWatchedStatuses({ tt0000001: true });

    expect(cb.dataset.watched).toBe("true");
    expect(watchedSet.has("tt0000001")).toBe(true);
  });

  test("ignores episodes with isWatched=false", () => {
    const { cb } = makeCheckbox({ titleId: "tt0000002" });

    applyWatchedStatuses({ tt0000002: false });

    expect(cb.dataset.watched).toBeUndefined();
    expect(watchedSet.has("tt0000002")).toBe(false);
  });

  test("handles missing DOM checkboxes gracefully", () => {
    expect(() => applyWatchedStatuses({ tt9999999: true })).not.toThrow();
    expect(watchedSet.has("tt9999999")).toBe(true);
  });
});

// ─── getSeasonCheckboxes / getSelectableCheckboxes ────────────────────────────

describe("getSeasonCheckboxes / getSelectableCheckboxes", () => {
  test("getSeasonCheckboxes returns all injected checkboxes", () => {
    makeCheckbox({ titleId: "tt0000001" });
    makeCheckbox({ titleId: "tt0000002", watched: true });
    expect(getSeasonCheckboxes()).toHaveLength(2);
  });

  test("getSelectableCheckboxes excludes watched and loading checkboxes", () => {
    makeCheckbox({ titleId: "tt0000001" });
    makeCheckbox({ titleId: "tt0000002", watched: true });
    makeCheckbox({ titleId: "tt0000003", loading: true });
    expect(getSelectableCheckboxes()).toHaveLength(1);
    expect(getSelectableCheckboxes()[0].dataset.titleId).toBe("tt0000001");
  });
});

// ─── enablePendingCheckboxes ──────────────────────────────────────────────────

describe("enablePendingCheckboxes", () => {
  test("enables and relabels checkboxes that were loading", () => {
    const { cb, span } = makeCheckbox({ titleId: "tt0000001", loading: true });
    makeCounter();

    enablePendingCheckboxes();

    expect(cb.disabled).toBe(false);
    expect(cb.dataset.loading).toBeUndefined();
    expect(span.textContent).toBe("Mark as seen");
  });

  test("does not touch watched checkboxes", () => {
    const { cb } = makeCheckbox({
      titleId: "tt0000002",
      watched: true,
      loading: true,
    });
    cb.disabled = true;
    makeCounter();

    enablePendingCheckboxes();

    expect(cb.disabled).toBe(true);
  });
});

// ─── updateCounter ────────────────────────────────────────────────────────────

describe("updateCounter", () => {
  test("shows Loading… when any checkbox has data-loading", () => {
    makeCheckbox({ titleId: "tt0000001", loading: true });
    const badge = makeCounter();

    updateCounter();

    expect(badge.textContent).toBe("Loading…");
  });

  test("shows correct selection count when ready", () => {
    makeCheckbox({ titleId: "tt0000001", checked: false });
    makeCheckbox({ titleId: "tt0000002", checked: true });
    makeCheckbox({ titleId: "tt0000003", watched: true });
    const badge = makeCounter();

    updateCounter();

    expect(badge.textContent).toBe("1 of 2 selected");
  });

  test("shows yellow color when episodes are checked", () => {
    makeCheckbox({ titleId: "tt0000001", checked: true });
    const badge = makeCounter();
    updateCounter();
    expect(badge.style.color).toBe("rgb(245, 197, 24)");
  });

  test("shows grey when nothing is selected", () => {
    makeCheckbox({ titleId: "tt0000001", checked: false });
    const badge = makeCounter();
    updateCounter();
    expect(badge.style.color).toBe("rgb(136, 136, 136)");
  });
});

// ─── createApi — prefetchWatchedStatus ───────────────────────────────────────

describe("prefetchWatchedStatus", () => {
  test("resolves to empty map when given no IDs", async () => {
    const mockGmXhr = jest.fn();
    const { prefetchWatchedStatus } = createApi(mockGmXhr);

    const result = await prefetchWatchedStatus([]);
    expect(result).toEqual({});
    expect(mockGmXhr).not.toHaveBeenCalled();
  });

  test("returns a map of watched statuses from the API", async () => {
    const mockGmXhr = jest.fn(({ onload }) => {
      onload({
        status: 200,
        responseText: JSON.stringify({
          data: {
            titles: [
              { id: "tt0000001", userWatchedStatus: { isWatched: true } },
              { id: "tt0000002", userWatchedStatus: { isWatched: false } },
            ],
          },
        }),
      });
    });
    const { prefetchWatchedStatus } = createApi(mockGmXhr);

    const result = await prefetchWatchedStatus(["tt0000001", "tt0000002"]);
    expect(result).toEqual({ tt0000001: true, tt0000002: false });
  });

  test("resolves to empty map on invalid JSON", async () => {
    const mockGmXhr = jest.fn(({ onload }) => {
      onload({ status: 200, responseText: "not json" });
    });
    const { prefetchWatchedStatus } = createApi(mockGmXhr);

    const result = await prefetchWatchedStatus(["tt0000001"]);
    expect(result).toEqual({});
  });

  test("resolves to empty map on network error", async () => {
    const mockGmXhr = jest.fn(({ onerror }) => {
      onerror(new Error("Network error"));
    });
    const { prefetchWatchedStatus } = createApi(mockGmXhr);

    const result = await prefetchWatchedStatus(["tt0000001"]);
    expect(result).toEqual({});
  });
});

// ─── createApi — markAsWatched ────────────────────────────────────────────────

describe("markAsWatched", () => {
  test("resolves with the title ID on success", async () => {
    const mockGmXhr = jest.fn(({ onload }) => {
      onload({
        status: 200,
        responseText: JSON.stringify({
          data: { addWatchedTitle: { success: true, message: [] } },
        }),
      });
    });
    const { markAsWatched } = createApi(mockGmXhr);

    await expect(markAsWatched("tt1234567")).resolves.toBe("tt1234567");
  });

  test("rejects when the API returns success:false", async () => {
    const mockGmXhr = jest.fn(({ onload }) => {
      onload({
        status: 200,
        responseText: JSON.stringify({
          data: { addWatchedTitle: { success: false } },
          errors: [{ message: "Not authorized" }],
        }),
      });
    });
    const { markAsWatched } = createApi(mockGmXhr);

    await expect(markAsWatched("tt1234567")).rejects.toThrow("Not authorized");
  });

  test("rejects on network error", async () => {
    const mockGmXhr = jest.fn(({ onerror }) => {
      onerror(new Error("Network error"));
    });
    const { markAsWatched } = createApi(mockGmXhr);

    await expect(markAsWatched("tt1234567")).rejects.toThrow("Network error");
  });
});

// ─── attachButtonProgress ─────────────────────────────────────────────────────

describe("attachButtonProgress", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function makeBtn(text = "★  Mark Checked as Seen") {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.background = "#f5c518";
    btn.style.color = "#000";
    return btn;
  }

  test("returns advance and finish functions", () => {
    const progress = attachButtonProgress(makeBtn(), 3);
    expect(typeof progress.advance).toBe("function");
    expect(typeof progress.finish).toBe("function");
  });

  test("replaces button content with fill and label elements", () => {
    const btn = makeBtn();
    attachButtonProgress(btn, 3);
    expect(btn.querySelector("div")).not.toBeNull();
    expect(btn.querySelector("span").textContent).toBe("0 / 3");
  });

  test("advance updates the fill width after draining", () => {
    const btn = makeBtn();
    const progress = attachButtonProgress(btn, 4);
    const fill = btn.querySelector("div");

    progress.advance(true);
    jest.advanceTimersByTime(0);
    expect(fill.style.width).toBe("25%");

    progress.advance(true);
    jest.advanceTimersByTime(150);
    expect(fill.style.width).toBe("50%");
  });

  test("advance increments the label counter", () => {
    const btn = makeBtn();
    const progress = attachButtonProgress(btn, 2);
    const label = btn.querySelector("span");

    progress.advance(true);
    jest.advanceTimersByTime(0);
    expect(label.textContent).toBe("1 / 2");
  });

  test("finish shows success state and restores button after delay", () => {
    const origText = "★  Mark Checked as Seen";
    const btn = makeBtn(origText);
    const progress = attachButtonProgress(btn, 1);

    progress.advance(true);
    progress.finish(false);

    jest.advanceTimersByTime(150);
    expect(btn.querySelector("span").textContent).toBe("✓ 1 marked");

    jest.advanceTimersByTime(1500);
    expect(btn.textContent).toBe(origText);
    expect(btn.style.background).toBe("rgb(245, 197, 24)");
  });

  test("finish shows failure state with longer restore delay", () => {
    const origText = "★  Mark Checked as Seen";
    const btn = makeBtn(origText);
    const progress = attachButtonProgress(btn, 2);

    progress.advance(true);
    progress.advance(false);
    progress.finish(true);

    jest.advanceTimersByTime(150);
    jest.advanceTimersByTime(150);

    const label = btn.querySelector("span");
    expect(label.textContent).toBe("1 ok · 1 failed");

    jest.advanceTimersByTime(1500);
    expect(btn.textContent).not.toBe(origText);

    jest.advanceTimersByTime(1500);
    expect(btn.textContent).toBe(origText);
  });

  test("finish waits for the drain queue to complete before showing final state", () => {
    const btn = makeBtn();
    const progress = attachButtonProgress(btn, 3);

    progress.advance(true);
    progress.advance(true);
    progress.advance(true);
    progress.finish(false);

    const label = btn.querySelector("span");
    expect(label.textContent).not.toBe("✓ 3 marked");

    jest.advanceTimersByTime(150);
    jest.advanceTimersByTime(150);
    jest.advanceTimersByTime(150);

    expect(label.textContent).toBe("✓ 3 marked");
  });
});

// ─── Snapshot Tests ───────────────────────────────────────────────────────────

describe("UI Component Snapshots", () => {
  test("button progress HTML structure matches snapshot", () => {
    const btn = document.createElement("button");
    btn.textContent = "★  Mark Checked as Seen";
    btn.style.background = "#f5c518";
    btn.style.color = "#000";

    attachButtonProgress(btn, 5);

    expect(btn.outerHTML).toMatchSnapshot();
  });

  test("counter badge HTML matches snapshot", () => {
    const badge = document.createElement("div");
    badge.id = "imdb-ms-counter";
    badge.textContent = "2 of 5 selected";
    badge.style.color = "#f5c518";

    expect(badge.outerHTML).toMatchSnapshot();
  });

  test("checkbox label wrapper HTML matches snapshot", () => {
    const { label } = makeCheckbox({ titleId: "tt1234567" });
    expect(label.outerHTML).toMatchSnapshot();
  });

  test("watched checkbox label wrapper HTML matches snapshot", () => {
    const { label } = makeCheckbox({ titleId: "tt1234567", watched: true });
    expect(label.outerHTML).toMatchSnapshot();
  });

  test("loading checkbox label wrapper HTML matches snapshot", () => {
    const { label } = makeCheckbox({ titleId: "tt1234567", loading: true });
    expect(label.outerHTML).toMatchSnapshot();
  });
});
