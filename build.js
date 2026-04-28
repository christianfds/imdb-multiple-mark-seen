"use strict";

const esbuild = require("esbuild");
const fs = require("fs");

// The userscript header lives in src/index.js as a comment block.
// esbuild strips non-legal comments, so we extract and re-inject it as a banner.
const src = fs.readFileSync("src/index.js", "utf8");
const headerMatch = src.match(/(\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==)/);
if (!headerMatch) throw new Error("Userscript header not found in src/index.js");
const header = headerMatch[1];

fs.mkdirSync("dist", { recursive: true });

esbuild.buildSync({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "iife",
  outfile: "dist/imdb-mark-seen.user.js",
  banner: { js: header },
  platform: "browser",
  // GM_xmlhttpRequest is a Tampermonkey global — do not attempt to resolve it.
  external: [],
  minifyWhitespace: false,
  minifySyntax: false,
  legalComments: "none",
});

console.log("Built dist/imdb-mark-seen.user.js");
