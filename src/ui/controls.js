"use strict";

const { getSeasonCheckboxes, getSelectableCheckboxes } = require("../dom/dom");
const { applyWatchedToCheckbox } = require("../dom/watched");
const { watchedSet } = require("../core/state");
const { updateCounter } = require("../dom/counter");
const { showToast } = require("./toast");
const { attachButtonProgress } = require("./progress");

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

function injectControls(api) {
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

  const selBtn = document.createElement("button");
  selBtn.id = "imdb-ms-selall";
  selBtn.textContent = "Select All";
  styleBtn(selBtn, "#333", "#fff");

  let allSel = false;
  selBtn.onclick = () => {
    allSel = !allSel;
    getSelectableCheckboxes().forEach((cb) => { cb.checked = allSel; });
    selBtn.textContent = allSel ? "Deselect All" : "Select All";
    updateCounter();
  };

  const markBtn = document.createElement("button");
  markBtn.id = "imdb-ms-mark";
  markBtn.textContent = "★  Mark Checked as Seen";
  styleBtn(markBtn, "#f5c518", "#000");
  markBtn.onmouseenter = () => { markBtn.style.background = "#e6b800"; };
  markBtn.onmouseleave = () => { markBtn.style.background = "#f5c518"; };

  markBtn.onclick = async () => {
    const checked = getSeasonCheckboxes().filter((cb) => cb.checked);
    if (!checked.length) {
      showToast("No episodes selected — tick some checkboxes first.", "info", false);
      return;
    }

    markBtn.disabled = true;

    const ids = checked.map((cb) => cb.dataset.titleId);
    const ok = [], fail = [];
    const progress = attachButtonProgress(markBtn, ids.length);

    await Promise.all(
      ids.map((id) =>
        api.markAsWatched(id)
          .then(() => { ok.push(id);   progress.advance(true);  })
          .catch(() => { fail.push(id); progress.advance(false); }),
      ),
    );

    markBtn.disabled = false;
    progress.finish(fail.length > 0);

    if (!fail.length) {
      checked.forEach((cb) => {
        watchedSet.add(cb.dataset.titleId);
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

module.exports = { injectControls };
