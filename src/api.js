"use strict";

const { GRAPHQL_URL, ADD_MUTATION, PERSONALIZED_HASH } = require("./constants");
const { gqlHeaders } = require("./utils");

function createApi(gmXhr) {
  function markAsWatched(titleId) {
    return new Promise((resolve, reject) => {
      gmXhr({
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
      gmXhr({
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

  return { markAsWatched, prefetchWatchedStatus };
}

module.exports = { createApi };
