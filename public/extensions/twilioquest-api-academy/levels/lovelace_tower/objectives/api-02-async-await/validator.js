const assert = require("assert");
const { readdirSync } = require("fs");

const assertTestCase = (testFunction) => async (input, expected) => {
  const testResult = await testFunction(input);

  assert.strictEqual(
    testResult,
    expected,
    `Expected "${expected}" but received "${testResult}".`
  );
};

module.exports = async function (helper) {
  let context;

  try {
    context = await helper.pullVarsFromQuestIdeUserCodeLocalScope(
      ["findLastFileInDir"],
      "api-02-async-await"
    );

    assert(
      context.findLastFileInDir,
      "The function findLastFileInDir is not defined!"
    );

    const test = assertTestCase(context.findLastFileInDir);
    const testDirectory = `${__dirname}/houses`;
    const dir = readdirSync(testDirectory);
    const lastEntry = dir[dir.length - 1];

    await test(testDirectory, lastEntry);
  } catch (err) {
    helper.fail(err);
    return;
  }

  helper.success("Great job!");
};
