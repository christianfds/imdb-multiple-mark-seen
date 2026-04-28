"use strict";

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

module.exports = { ensureToastContainer, showToast, fadeOut };
