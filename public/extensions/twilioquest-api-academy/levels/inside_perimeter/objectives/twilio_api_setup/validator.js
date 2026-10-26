const twilio = require('twilio');

module.exports = (context, callback) => {
  const { accountSid, authToken } = context.validationFields;

  if (!accountSid || !authToken) {
    return callback({
      message: `An Account SID and Auth Token are required - please enter them in the text fields provided.`,
    });
  }

  let client;

  try {
    client = twilio(accountSid, authToken);
  } catch (e) {
    return callback({
      message: `A valid Twilio account SID is required - you'll find this at twilio.com/console, and it starts with an "AC"`,
    });
  }

  client.api.accounts(accountSid).fetch((err, response) => {
    console.log(err, response);
    if (err) {
      callback({
        message: `The Statue of Truth couldn't verify your Twilio credentials - ensure they are correct and try again.`,
      });
    } else {
      callback(null, {
        message: `Your credentials are approved. The Statue of Truth will save them for later.`,
        env: [
          { name: 'TWILIO_ACCOUNT_SID', value: accountSid },
          { name: 'TWILIO_AUTH_TOKEN', value: authToken, concealed: true },
        ],
      });
    }
  });
};