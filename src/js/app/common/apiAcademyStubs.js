'use strict';

/*
 * Local stand-ins for the dead twilio.com/quest/magic API used by the API
 * Academy lessons (public/extensions/twilioquest-api-academy, Lovelace Tower).
 *
 * ONE plain CommonJS module, loaded by both:
 *   - src/js/app/components/hack_interface/validator/ValidationHelper.js
 *     (validators, and learner code run by pullVarsFromQuestIdeUserCodeLocalScope)
 *   - public/code_runner/runner.js (the learner's code in the hidden QuestIDE
 *     runner window), which requires the Babel-compiled copy at
 *     public/app/common/apiAcademyStubs.js
 *
 * Keep it dependency-free and free of Electron/React imports so that both can
 * load it and so that it can be unit-tested in plain Node.
 *
 * Routes, all GET and all answered locally:
 *   https://twilio.com/quest/magic                       text/plain phrase (api-03)
 *   https://twilio.com/quest/magic/divination            JSON array of books (api-04)
 *   https://twilio.com/quest/magic/divination?target=lovelace_secret_statue
 *                                                        GET/PATCH inscription (api-05)
 * "www." and a trailing slash are accepted on the first two. Everything else
 * goes to the real fetch.
 *
 * These stand-ins replace a service that no longer exists, so they always
 * apply (they are not gated on the backend setting).
 */

// api-03. Ada Lovelace, Note A to her translation of Menabrea's "Sketch of the
// Analytical Engine", 1843. Public domain.
const MAGICAL_PHRASE =
  'The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers and leaves.';

// api-04. The four papers whose tomes stand in Lovelace Tower
// (levels/lovelace_tower/conversations/book-1..4.pug).
// Sources of each value:
//   id          order of book-1..4.pug.
//   title, author.name
//               the pug files (author.name is the first author).
//   yearPublished, pageCount
//               Crossref REST API, fetched 2026-10-26, "issued" year and the
//               "page" range (pageCount = last - first + 1):
//     1  10.1177/0047281617721853  issued 2017, page 295-330 = 36. Matches the
//        api-04 walkthrough sample (2017, 36).
//     2  10.1145/2896587           issued 2016, page 62-69 = 8. Matches the
//        walkthrough sample (2016, 8).
//     3  10.1109/VLHCC.2016.7739689 (IEEE document 7739689; found with
//        query.bibliographic) issued 2016, page 223-227 = 5. Not in the
//        walkthrough sample.
//     4  10.1109/MS.2009.193 (found with query.bibliographic) issued 2009,
//        page 27-34 = 8. Not in the walkthrough sample.
//   link        https://doi.org/<doi> as above.
const BOOKS = [
  {
    id: 1,
    title:
      'Application Programming Interface Documentation: What Do Software Developers Want?',
    yearPublished: 2017,
    link: 'https://doi.org/10.1177/0047281617721853',
    author: { name: 'Michael Meng' },
    metadata: { pageCount: 36 },
  },
  {
    id: 2,
    title: 'Improving API Usability',
    yearPublished: 2016,
    link: 'https://doi.org/10.1145/2896587',
    author: { name: 'Brad A. Myers' },
    metadata: { pageCount: 8 },
  },
  {
    id: 3,
    title:
      'Perceived Obstacles by Novice Developers Adopting User Interface APIs and Tools',
    yearPublished: 2016,
    link: 'https://doi.org/10.1109/VLHCC.2016.7739689',
    author: { name: 'Irum Rauf' },
    metadata: { pageCount: 5 },
  },
  {
    id: 4,
    title: 'What Makes APIs Hard to Learn? Answers from Developers',
    yearPublished: 2009,
    link: 'https://doi.org/10.1109/MS.2009.193',
    author: { name: 'Martin P. Robillard' },
    metadata: { pageCount: 8 },
  },
];

const MAGIC_ENDPOINT = 'https://twilio.com/quest/magic';
const DIVINATION_ENDPOINT = 'https://twilio.com/quest/magic/divination';
const INSCRIPTION_TARGET_URL =
  'https://twilio.com/quest/magic/divination?target=lovelace_secret_statue';

function getBooks() {
  // A fresh copy each time, so learner code cannot change what the validator
  // later reads.
  return JSON.parse(JSON.stringify(BOOKS));
}

function makeResponse(url, contentType, bodyText) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url,
    headers: {
      get(name) {
        return String(name).toLowerCase() === 'content-type'
          ? contentType
          : null;
      },
    },
    async text() {
      return bodyText;
    },
    async json() {
      return JSON.parse(bodyText);
    },
  };
}

// Which stand-in route, if any, does this request hit? Returns 'phrase',
// 'books' or null. Only plain GET requests with no extra query string match
// (the divination route accepts any query without a "target").
function matchRoute(urlString, method) {
  if (method !== 'GET') return null;

  let url;
  try {
    url = new URL(urlString);
  } catch (_) {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.hostname !== 'twilio.com' && url.hostname !== 'www.twilio.com') {
    return null;
  }
  if (url.port !== '') return null;

  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname === '/quest/magic') {
    return url.search === '' ? 'phrase' : null;
  }
  if (pathname === '/quest/magic/divination') {
    return url.searchParams.has('target') ? null : 'books';
  }
  return null;
}

function inscriptionIsCorrect(inscription) {
  const inscriptionLowercased = inscription.replace(/[^A-z ]/g, '').toLowerCase();

  return (
    inscriptionLowercased.includes('creators of the cloud') &&
    inscriptionLowercased.includes('formed through a simple') &&
    inscriptionLowercased.includes('strung together') &&
    inscriptionLowercased.includes('requests may return') &&
    inscriptionLowercased.includes('the towers supply') &&
    inscriptionLowercased.includes('stay locked until i am able to') &&
    inscriptionLowercased.includes('magical eye')
  );
}

// api-05. Moved here unchanged from ValidationHelper.fetchOverride and
// public/code_runner/runner.js (Marvel Johnson [12/14/2022]: a workaround to a
// validation bug in the TwilioQuest-Server's /magic route). `state` holds the
// last accepted inscription between the PATCH and the validator's guid= check.
function inscriptionFetch(state, input, init) {
  if (!state.fakeFetch) {
    state.fakeFetch = {};
  }

  const response = {
    body: {
      data: {
        inscription: '',
        operational: false,
      },
    },
    // Only adding this because the player will have been introduced to it in a previous objective
    async text() {
      return this.body;
    },
    async json() {
      return this.body;
    },
  };

  if (input.includes('guid=')) {
    const inscription = state.fakeFetch.inscription
      ? state.fakeFetch.inscription
      : '';

    if (inscriptionIsCorrect(inscription)) {
      response.body.data.operational = true;
    } else {
      response.body = {
        errorMessage:
          'The inscription is still corrupted! Double check your work and try again.',
      };
    }
  } else {
    const method = init.method.toLowerCase();

    switch (method) {
      case 'patch':
        try {
          JSON.parse(init.body);
        } catch (_) {
          response.body = {
            errorMessage:
              'Your request "body" is not JSON parsable! Double check the objective description on how to send the patch request and try again.',
          };

          return response;
        }

        const jsonBody = JSON.parse(init.body);

        if (
          jsonBody.guid === undefined ||
          jsonBody.data === undefined ||
          jsonBody.data.inscription === undefined
        ) {
          response.body = {
            errorMessage: `Your patch is missing the "${
              jsonBody.guid === undefined
                ? 'guid'
                : jsonBody.data === undefined
                ? 'data'
                : jsonBody.data.inscription === undefined
                ? 'data.inscription'
                : ''
            }" property! Double check that your formatting matches what is shown in the objective description and try again.`,
          };
        } else if (!inscriptionIsCorrect(jsonBody.data.inscription)) {
          response.body = {
            errorMessage:
              'The inscription is still corrupted! Double check your work and try again.',
          };
        } else {
          state.fakeFetch.inscription = jsonBody.data.inscription;
          response.body = {
            message: 'Your patch was received!',
          };
        }
        break;
      case 'get':
        response.body.data.inscription = `Oh, great adGRTgfhuwef, let me apply\n\
This divination spell, newly *77hjfslkefWSghu3 phrase,\n\
Anvnteu398gtEWRbkyrU thanks to a most helpful API,\n\n\
That my LIUH4f92nfsDBHerWAGYito the knowledge I seek\n\
To open my mind to JHBUfRRE#234ijgyREvd\n\
Of resources both clear and covert.\n\n\
For the final door shall 99234jtgeRasER$TGWE49 scry\n\
The programmable answers that will remove this haze\n\
From my querent and OOIJBUe11239sdSBs.`;
        break;
      default:
        response.body = {
          errorMessage: `TwilioQuest did not expect "${method}" as the request method! Make sure you're using "PATCH" and try again.`,
        };
    }
  }

  return response;
}

/**
 * Build a fetch replacement.
 * @param {Function} realFetch  Used for every request that is not a stand-in.
 *   Called with the caller's original arguments.
 * @param {Object} [state]  Where the api-05 stand-in remembers the patched
 *   inscription. Defaults to a new object, so each override has its own memory.
 */
function createFetchOverride(realFetch, state = {}) {
  return function fetchOverride(input, init = { method: 'GET', body: {} }) {
    const originalArgs = arguments;

    // Like the async function this replaces: anything thrown becomes a
    // rejected promise.
    return new Promise(resolve => {
      const url =
        typeof input === 'string'
          ? input
          : input && input.href
          ? input.href
          : '';

      // api-05: unchanged behaviour.
      if (url.includes(INSCRIPTION_TARGET_URL)) {
        return resolve(inscriptionFetch(state, url, init));
      }

      // api-03 and api-04.
      const method = String((init && init.method) || 'GET').toUpperCase();
      const route = matchRoute(url, method);
      if (route === 'phrase') {
        return resolve(makeResponse(url, 'text/plain', MAGICAL_PHRASE));
      }
      if (route === 'books') {
        return resolve(
          makeResponse(url, 'application/json', JSON.stringify(getBooks()))
        );
      }

      resolve(realFetch.apply(undefined, originalArgs));
    });
  };
}

module.exports = {
  createFetchOverride,
  matchRoute,
  getBooks,
  MAGICAL_PHRASE,
  BOOKS,
  MAGIC_ENDPOINT,
  DIVINATION_ENDPOINT,
  INSCRIPTION_TARGET_URL,
};
