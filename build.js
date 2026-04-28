"use strict";

// Build script: strips the Node/Jest module.exports block from the source and
// writes a clean browser-only artifact to dist/.
//
// When the source is split into ES modules, update this to use esbuild with
// bundle: true so all imports are resolved into the single .user.js output.

const fs = require("fs");

const src = fs.readFileSync("imdb-mark-seen.user.js", "utf8");

// The source uses `if (typeof module !== "undefined") { exports } else { browser init }`
// so Jest can import functions without a build step. The dist removes this
// branching — browsers only need the else path.
let dist = src;

// Step 1: remove from the section header comment through the "} else {\n" line.
dist = dist.replace(
  /\n\n  \/\/ ─── Test exports[\s\S]*?\} else \{\n/,
  "\n\n"
);

// Step 2: remove the closing `  }` of the now-gone else block that sits
// immediately before `})();` at the end of the IIFE.
dist = dist.replace(/\n  \}\n\}\)\(\);\n?$/, "\n})();\n");

if (!dist.includes("injectStyles()") || dist.includes("module.exports")) {
  throw new Error(
    "Build sanity check failed — regex patterns may not match the source"
  );
}

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/imdb-mark-seen.user.js", dist);
console.log("Built dist/imdb-mark-seen.user.js");
