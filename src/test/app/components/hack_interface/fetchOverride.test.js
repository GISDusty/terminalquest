import ValidationHelper from '../../../../js/app/components/hack_interface/validator/ValidationHelper';
import { MAGICAL_PHRASE, BOOKS } from '../../../../js/app/common/apiAcademyStubs';

// ValidationHelper captures window.fetch when it is imported, so it is the
// jsdom/Electron one here. Call the method on a bare object: it needs no
// constructor state.
const { fetchOverride } = ValidationHelper.prototype;
const make = () => ({ fetchOverride });

const STATUE =
  'https://twilio.com/quest/magic/divination?target=lovelace_secret_statue';

describe('ValidationHelper.fetchOverride', () => {
  test('phrase', async () => {
    const response = await make().fetchOverride('https://twilio.com/quest/magic');
    expect(await response.text()).toBe(MAGICAL_PHRASE);
  });

  test('books', async () => {
    const response = await make().fetchOverride(
      'https://twilio.com/quest/magic/divination'
    );
    expect(await response.json()).toEqual(BOOKS);
  });

  test('api-05 GET and PATCH are unchanged', async () => {
    const helper = make();
    const get = await helper.fetchOverride(STATUE, { method: 'GET' });
    expect((await get.json()).data.operational).toBe(false);

    const bad = await helper.fetchOverride(STATUE, {
      method: 'PATCH',
      body: JSON.stringify({ guid: 'g', data: { inscription: 'x' } }),
    });
    expect((await bad.json()).errorMessage).toMatch(/still corrupted/);
  });

  test('anything else falls through to the real fetch', async () => {
    // Port 9 (discard) on localhost refuses the connection: a rejected
    // promise proves the real fetch ran, without leaving the machine.
    await expect(make().fetchOverride('http://127.0.0.1:9/')).rejects.toThrow();
  });
});
