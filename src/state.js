"use strict";

// Singleton set — persists watched state across React re-renders that wipe our
// injected DOM. Every injectCheckbox call checks this before hitting the API.
const watchedSet = new Set();

module.exports = { watchedSet };
