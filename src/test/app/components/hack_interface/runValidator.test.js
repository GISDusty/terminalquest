import runValidator from '../../../../js/app/components/hack_interface/validator/runValidator';

// Real (short) timers: fake timers are not supported in the Electron runner
const TIMEOUT = 150;
const GRACE = 60;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Run a validator with a simple helper that mirrors ValidationHelper
function run(validate) {
  const results = [];
  runValidator(
    validate,
    callback => ({
      success: message => callback(null, { message, env: [] }),
      fail: message => callback({ message }),
    }),
    (err, feedback) => results.push({ err, feedback }),
    { timeoutMs: TIMEOUT, graceMs: GRACE }
  );
  return results;
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

test('reports success', async () => {
  const results = run(async helper => helper.success('yay'));
  await sleep(10);
  expect(results).toHaveLength(1);
  expect(results[0].err).toBe(null);
  expect(results[0].feedback.message).toBe('yay');
});

test('reports fail', async () => {
  const results = run(async helper => helper.fail('nope'));
  await sleep(10);
  expect(results).toHaveLength(1);
  expect(results[0].err.message).toBe('nope');
});

test('fails when the validator hangs, and ignores a late success', async () => {
  let helper;
  const results = run(h => {
    helper = h;
    return new Promise(() => {});
  });
  await sleep(TIMEOUT / 2);
  expect(results).toHaveLength(0);
  await sleep(TIMEOUT);
  expect(results).toHaveLength(1);
  expect(results[0].err.message).toMatch(/took too long/);

  helper.success('too late');
  helper.fail('too late');
  await sleep(TIMEOUT);
  expect(results).toHaveLength(1);
});

test('fails when the validator resolves without reporting', async () => {
  const results = run(async () => {});
  await sleep(GRACE / 2);
  expect(results).toHaveLength(0);
  await sleep(GRACE);
  expect(results).toHaveLength(1);
  expect(results[0].err.message).toMatch(/without reporting/);
});

test('accepts a result reported after the validator returns, within the grace period', async () => {
  let helper;
  const results = run(async h => {
    helper = h;
  });
  await sleep(GRACE / 2);
  helper.success('late but fine');
  await sleep(TIMEOUT * 2);
  expect(results).toHaveLength(1);
  expect(results[0].err).toBe(null);
});

test('fails when the validator throws synchronously', () => {
  const results = run(() => {
    throw new Error('boom');
  });
  expect(results).toHaveLength(1);
  expect(results[0].err.message).toMatch(/boom/);
});

test('fails when the validator rejects', async () => {
  const results = run(async () => {
    throw new Error('rejected');
  });
  await sleep(10);
  expect(results).toHaveLength(1);
  expect(results[0].err.message).toMatch(/rejected/);
});

test('only the first result counts', async () => {
  const results = run(async helper => {
    helper.fail('first');
    helper.success('second');
  });
  await sleep(TIMEOUT * 2);
  expect(results).toHaveLength(1);
  expect(results[0].err.message).toBe('first');
});

test('non-promise validators are covered by the timeout only', async () => {
  const results = run(() => {});
  await sleep(GRACE * 2);
  expect(results).toHaveLength(0);
  await sleep(TIMEOUT);
  expect(results).toHaveLength(1);
});

test('legacy callback style works', () => {
  const results = [];
  runValidator(
    (helper, callback) => callback({ message: 'legacy' }),
    () => ({}),
    (err, feedback) => results.push({ err, feedback })
  );
  expect(results[0].err.message).toBe('legacy');
});
