"use strict";

function attachButtonProgress(btn, total) {
  const origText  = btn.textContent;
  const origBg    = btn.style.background;
  const origColor = btn.style.color;

  btn.style.position = "relative";
  btn.style.overflow = "hidden";
  btn.style.background = "#2a2a2a";
  btn.style.color = "#fff";

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

  const label = document.createElement("span");
  Object.assign(label.style, { position: "relative", zIndex: "1" });
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

module.exports = { attachButtonProgress };
