// How long a validator may run without calling success or fail. Generous,
// because some validators spawn processes and Python validators have their own
// 5s and 30s timers underneath this.
export const VALIDATOR_TIMEOUT_MS = 60 * 1000;

// Some validators return before they are done (e.g. they call helper.success
// from a child process 'close' handler). After the validator function returns
// without having reported, wait this long for a late result before giving up.
export const VALIDATOR_RETURN_GRACE_MS = 10 * 1000;

const TIMEOUT_MESSAGE = `
  The validator took too long to respond, so it was stopped. Please check
  your answer and try again.
`;

const NO_RESULT_MESSAGE = `
  The validator finished without reporting a result. Please check your
  answer and try again.
`;

const errorMessage = e =>
  `Sorry! The validator hit an unexpected error: ${
    (e && e.message) || String(e)
  }`;

/**
 * Run a validator function, guaranteeing that `onResult` is called exactly
 * once: with the validator's own success/fail, or with a failure if the
 * validator throws, rejects, times out, or returns without reporting.
 * Anything the validator reports after that is ignored.
 *
 * @param {function} validate - the validator's exported function
 * @param {function} createHelper - given the once-only callback, returns the
 *                                  helper to pass to the validator
 * @param {function} onResult - called with (err, feedback)
 * @returns {function} cancel - stop timers and ignore any further result
 */
export default function runValidator(
  validate,
  createHelper,
  onResult,
  { timeoutMs = VALIDATOR_TIMEOUT_MS, graceMs = VALIDATOR_RETURN_GRACE_MS } = {}
) {
  let settled = false;
  let timeoutTimer = null;
  let graceTimer = null;

  const settle = (err, feedback) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutTimer);
    clearTimeout(graceTimer);
    try {
      onResult(err, feedback);
    } catch (e) {
      console.error('Error while processing validation result', e);
    }
  };
  const fail = message => settle({ message });

  timeoutTimer = setTimeout(() => fail(TIMEOUT_MESSAGE), timeoutMs);

  try {
    const helper = createHelper(settle);
    const result = validate(helper, settle);

    if (result && typeof result.then === 'function') {
      result.then(
        () => {
          if (!settled) {
            graceTimer = setTimeout(() => fail(NO_RESULT_MESSAGE), graceMs);
          }
        },
        e => {
          console.error('Validator rejected', e);
          fail(errorMessage(e));
        }
      );
    }
    // Validators that return a non-promise may still call back later (the
    // legacy callback style), so those are only covered by the timeout.
  } catch (e) {
    console.error('Validator threw', e);
    fail(errorMessage(e));
  }

  return () => {
    settled = true;
    clearTimeout(timeoutTimer);
    clearTimeout(graceTimer);
  };
}
