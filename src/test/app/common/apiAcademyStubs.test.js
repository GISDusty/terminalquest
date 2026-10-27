import fs from 'fs';
import path from 'path';
import {
  createFetchOverride,
  matchRoute,
  getBooks,
  MAGICAL_PHRASE,
  BOOKS,
} from '../../../js/app/common/apiAcademyStubs';

const MAGIC = 'https://twilio.com/quest/magic';
const DIVINATION = 'https://twilio.com/quest/magic/divination';
const STATUE = `${DIVINATION}?target=lovelace_secret_statue`;

const REPAIRED = `Oh, great creators of The Cloud, let me apply
This divination spell, newly formed through a simple phrase,
Strung together thanks to a most helpful API,

That my requests may return the knowledge I seek
To open my mind to the tower’s supply
Of resources both clear and covert.

For the final door shall stay locked until I am able to scry
The programmable answers that will remove this haze
From my querent and magical eye.`;

function setup() {
  const realFetch = jest.fn(async () => ({ real: true }));
  return { realFetch, fetch: createFetchOverride(realFetch) };
}

describe('api-03 phrase route', () => {
  test.each([
    MAGIC,
    `${MAGIC}/`,
    'https://www.twilio.com/quest/magic',
    'https://www.twilio.com/quest/magic/',
  ])('%s returns the phrase', async url => {
    const { fetch, realFetch } = setup();
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(await response.text()).toBe(MAGICAL_PHRASE);
    expect(realFetch).not.toHaveBeenCalled();
  });

  test('explicit GET works, text is the Lovelace line', async () => {
    const { fetch } = setup();
    const response = await fetch(MAGIC, { method: 'GET' });
    expect(await response.text()).toBe(
      'The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers and leaves.'
    );
  });

  test('json() on the phrase rejects, like a real text/plain body', async () => {
    const { fetch } = setup();
    const response = await fetch(MAGIC);
    await expect(response.json()).rejects.toThrow();
  });
});

describe('api-04 books route', () => {
  test.each([DIVINATION, `${DIVINATION}/`, 'https://www.twilio.com/quest/magic/divination'])(
    '%s returns the books',
    async url => {
      const { fetch, realFetch } = setup();
      const response = await fetch(url, { method: 'GET' });
      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toBe('application/json');
      const books = await response.json();
      expect(books).toEqual(BOOKS);
      expect(JSON.parse(await response.text())).toEqual(BOOKS);
      expect(realFetch).not.toHaveBeenCalled();
    }
  );

  test('every book has the documented shape', () => {
    for (const book of getBooks()) {
      expect(typeof book.id).toBe('number');
      expect(typeof book.title).toBe('string');
      expect(typeof book.yearPublished).toBe('number');
      expect(book.link).toMatch(/^https:\/\/doi\.org\/10\./);
      expect(typeof book.author.name).toBe('string');
      expect(Number.isInteger(book.metadata.pageCount)).toBe(true);
    }
  });

  test('walkthrough sample values are present', () => {
    expect(BOOKS[0]).toMatchObject({
      id: 1,
      yearPublished: 2017,
      author: { name: 'Michael Meng' },
      metadata: { pageCount: 36 },
    });
    expect(BOOKS[1]).toMatchObject({
      id: 2,
      yearPublished: 2016,
      author: { name: 'Brad A. Myers' },
      metadata: { pageCount: 8 },
    });
  });

  test('each response is a fresh copy', async () => {
    const { fetch } = setup();
    const first = await (await fetch(DIVINATION)).json();
    first[0].author.name = 'changed';
    first.pop();
    const second = await (await fetch(DIVINATION)).json();
    expect(second).toEqual(BOOKS);
  });

  test('the validator thresholds (5, 100, 30, 15) give the expected names', () => {
    const names = threshold =>
      BOOKS.filter(b => b.metadata.pageCount > threshold).map(b => b.author.name);
    expect(names(5)).toEqual(['Michael Meng', 'Brad A. Myers', 'Martin P. Robillard']);
    expect(names(100)).toEqual([]);
    expect(names(30)).toEqual(['Michael Meng']);
    expect(names(15)).toEqual(['Michael Meng']);
  });
});

describe('fall-through to the real fetch', () => {
  test.each([
    ['https://example.com/'],
    ['https://twilio.com/quest/other'],
    ['https://twilio.com/quest/magic?x=1'],
    ['https://twilio.com/quest/magic/divination?target=other'],
    ['https://twilio.com/quest/magic/divinationx'],
    ['http://twilio.com/quest/magic'],
    ['https://evil.com/https://twilio.com/quest/magic'],
    ['https://twilio.com.evil.com/quest/magic'],
    ['not a url'],
  ])('%s', async url => {
    const { fetch, realFetch } = setup();
    const result = await fetch(url, { headers: { a: 'b' } });
    expect(result).toEqual({ real: true });
    expect(realFetch).toHaveBeenCalledWith(url, { headers: { a: 'b' } });
  });

  test('non-GET methods on the stand-in URLs go to the real fetch', async () => {
    const { fetch, realFetch } = setup();
    await fetch(MAGIC, { method: 'POST', body: 'x' });
    await fetch(DIVINATION, { method: 'PATCH', body: '{}' });
    expect(realFetch).toHaveBeenCalledTimes(2);
  });

  test('real fetch is called with the original arguments only', async () => {
    const { fetch, realFetch } = setup();
    await fetch('https://example.com/');
    expect(realFetch.mock.calls[0]).toEqual(['https://example.com/']);
  });

  test('matchRoute', () => {
    expect(matchRoute(MAGIC, 'GET')).toBe('phrase');
    expect(matchRoute(DIVINATION, 'GET')).toBe('books');
    expect(matchRoute(DIVINATION + '?guid=1', 'GET')).toBe('books');
    expect(matchRoute(STATUE, 'GET')).toBe(null);
    expect(matchRoute(MAGIC, 'POST')).toBe(null);
  });
});

describe('api-05 inscription route (behaviour moved unchanged)', () => {
  test('GET returns the corrupted inscription, not operational', async () => {
    const { fetch, realFetch } = setup();
    const body = await (await fetch(STATUE, { method: 'GET' })).json();
    expect(body.data.operational).toBe(false);
    expect(body.data.inscription).toMatch(/^Oh, great adGRTgfhuwef, let me apply/);
    expect(realFetch).not.toHaveBeenCalled();
  });

  test('GET with no init works, text() returns the body object', async () => {
    const { fetch } = setup();
    const response = await fetch(STATUE);
    expect(await response.text()).toEqual(await response.json());
    expect(response.ok).toBeUndefined();
  });

  test('guid check before any patch is an error', async () => {
    const { fetch } = setup();
    const body = await (await fetch(`${STATUE}&guid=abc`)).json();
    expect(body.errorMessage).toMatch(/still corrupted/);
  });

  test('a correct PATCH is stored and the guid check then reports operational', async () => {
    const { fetch } = setup();
    const patch = await fetch(STATUE, {
      method: 'PATCH',
      body: JSON.stringify({ guid: 'abc', data: { inscription: REPAIRED } }),
    });
    expect(await patch.json()).toEqual({ message: 'Your patch was received!' });
    const check = await (await fetch(`${STATUE}&guid=abc`)).json();
    expect(check.data.operational).toBe(true);
  });

  test('state is per override: a patch on one is not seen by another', async () => {
    const a = setup();
    const b = setup();
    await a.fetch(STATUE, {
      method: 'PATCH',
      body: JSON.stringify({ guid: 'abc', data: { inscription: REPAIRED } }),
    });
    const check = await (await b.fetch(`${STATUE}&guid=abc`)).json();
    expect(check.errorMessage).toMatch(/still corrupted/);
  });

  test('a wrong PATCH is rejected with the corrupted message', async () => {
    const { fetch } = setup();
    const body = await (
      await fetch(STATUE, {
        method: 'PATCH',
        body: JSON.stringify({ guid: 'abc', data: { inscription: 'nope' } }),
      })
    ).json();
    expect(body.errorMessage).toMatch(/still corrupted/);
  });

  test('PATCH error messages', async () => {
    const { fetch } = setup();
    const notJson = await (await fetch(STATUE, { method: 'PATCH', body: '{' })).json();
    expect(notJson.errorMessage).toMatch(/not JSON parsable/);
    const noGuid = await (
      await fetch(STATUE, { method: 'PATCH', body: JSON.stringify({ data: { inscription: 'x' } }) })
    ).json();
    expect(noGuid.errorMessage).toMatch(/missing the "guid" property/);
    const noData = await (
      await fetch(STATUE, { method: 'PATCH', body: JSON.stringify({ guid: 1 }) })
    ).json();
    expect(noData.errorMessage).toMatch(/missing the "data" property/);
    const noInscription = await (
      await fetch(STATUE, { method: 'PATCH', body: JSON.stringify({ guid: 1, data: {} }) })
    ).json();
    expect(noInscription.errorMessage).toMatch(/missing the "data.inscription" property/);
  });

  test('other methods are rejected', async () => {
    const { fetch } = setup();
    const body = await (await fetch(STATUE, { method: 'DELETE' })).json();
    expect(body.errorMessage).toMatch(/did not expect "delete"/);
  });
});

describe('both sides use the shared module', () => {
  const root = path.resolve(__dirname, '..', '..', '..', '..');

  test('runner.js has no copy of the stand-ins and loads the shared module', () => {
    const runner = fs.readFileSync(
      path.join(root, 'public', 'code_runner', 'runner.js'),
      'utf8'
    );
    expect(runner).toContain("require('../app/common/apiAcademyStubs')");
    expect(runner).not.toContain('lovelace_secret_statue');
  });

  test('ValidationHelper has no copy of the stand-ins and imports the shared module', () => {
    const helper = fs.readFileSync(
      path.join(
        root,
        'src/js/app/components/hack_interface/validator/ValidationHelper.js'
      ),
      'utf8'
    );
    expect(helper).toContain("from '../../../common/apiAcademyStubs'");
    expect(helper).not.toContain('lovelace_secret_statue');
  });
});
