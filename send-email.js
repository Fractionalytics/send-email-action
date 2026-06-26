const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

// Credentials and message are read from the environment. Required credentials
// must all be present; subject/text are required to send anything meaningful.
const REQUIRED_CREDENTIALS = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER'];
const REQUIRED_MESSAGE = ['SUBJECT', 'TEXT'];

// Strip CR/LF so a crafted subject can't attempt SMTP header injection.
function sanitizeHeader(value) {
  return String(value).replace(/[\r\n]+/g, ' ');
}

// Build the email config from an environment object, validating presence.
// Exported so tests can assert validation without touching the network.
function buildConfig(env = process.env) {
  const missing = [...REQUIRED_CREDENTIALS, ...REQUIRED_MESSAGE].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  const user = env.GMAIL_USER;
  return {
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    refreshToken: env.GMAIL_REFRESH_TOKEN,
    user,
    fromEmail: env.FROM_EMAIL || user,
    toEmail: env.TO_EMAIL || user,
    subject: sanitizeHeader(env.SUBJECT),
    text: env.TEXT,
  };
}

// Dependencies are injectable so tests can supply fakes for the OAuth client
// and the Nodemailer transporter without performing real network calls.
async function sendEmail({
  env = process.env,
  createTransport = nodemailer.createTransport,
  createOAuthClient = (config) => {
    const client = new google.auth.OAuth2(config.clientId, config.clientSecret, REDIRECT_URI);
    client.setCredentials({ refresh_token: config.refreshToken });
    return client;
  },
} = {}) {
  const config = buildConfig(env);

  const oauth2Client = createOAuthClient(config);
  const accessTokenResponse = (await oauth2Client.getAccessToken()) || {};
  const accessToken = accessTokenResponse.token;
  if (!accessToken) {
    throw new Error('Failed to obtain OAuth2 access token (refresh token may be expired or revoked)');
  }

  const transporter = createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: config.user,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      accessToken,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  const result = await transporter.sendMail({
    from: config.fromEmail,
    to: config.toEmail,
    subject: config.subject,
    text: config.text,
  });

  // Log only the message id — never the full result or token material.
  console.log('Email sent:', result.messageId);
  return result;
}

module.exports = { sendEmail, buildConfig, sanitizeHeader };

// Run only when invoked directly (not when imported by tests), and surface
// failures as a non-zero exit so the GitHub Action step turns red.
if (require.main === module) {
  sendEmail().catch((error) => {
    console.error('Error sending email:', error.message);
    process.exitCode = 1;
  });
}
