"use strict";

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

module.exports = { getCookie, randomRid, getShowId, gqlHeaders };
