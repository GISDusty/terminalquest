// The game runs this when the player clicks HACK. Call helper.success(...) or
// helper.fail(...) exactly once. Details: docs/authoring/validator.md
module.exports = async helper => {
  const { answer } = helper.validationFields;

  if (answer === undefined || answer.trim() === '') {
    return helper.fail('The field is empty. Type a word and click HACK.');
  }

  if (answer.trim().toLowerCase() !== 'hello') {
    return helper.fail(
      `"${answer}" is not the passphrase. Check the Objective tab.`
    );
  }

  helper.success('Access granted. The terminal says hello back.');
};
