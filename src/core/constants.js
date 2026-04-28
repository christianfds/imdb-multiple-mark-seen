"use strict";

const GRAPHQL_URL = "https://api.graphql.imdb.com/";

const ADD_MUTATION = `mutation AddWatchedTitle($titleId: ID!) {
  addWatchedTitle(titleId: $titleId) {
    message { language value }
    success
  }
}`;

const PERSONALIZED_HASH =
  "a746c4218025e024a8899cd06927c73b311178c2a51ef64bbd3a87fc7b6268cd";

module.exports = { GRAPHQL_URL, ADD_MUTATION, PERSONALIZED_HASH };
