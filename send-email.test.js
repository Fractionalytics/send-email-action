const { test } = require('node:test');
const assert = require('node:assert/strict');

const { sendEmail, buildConfig, sanitizeHeader } = require('./send-email');

// A complete, valid environment. Individual tests clone and mutate this.
function validEnv(overrides = {}) {
  return {
    GMAIL_CLIENT_ID: 'client-id',
    GMAIL_CLIENT_SECRET: 'client-secret',
    GMAIL_REFRESH_TOKEN: 'refresh-token',
    GMAIL_USER: 'me@example.com',
    SUBJECT: 'Hello',
    TEXT: 'Body',
    ...overrides,
  };
}

// Fake OAuth client factory that returns a usable access token.
function fakeOAuthClient() {
  return () => ({ getAccessToken: async () => ({ token: 'access-token' }) });
}

test('buildConfig defaults from/to to GMAIL_USER when not provided', () => {
  const config = buildConfig(validEnv());
  assert.equal(config.fromEmail, 'me@example.com');
  assert.equal(config.toEmail, 'me@example.com');
});

test('buildConfig honors explicit FROM_EMAIL and TO_EMAIL', () => {
  const config = buildConfig(validEnv({ FROM_EMAIL: 'from@x.com', TO_EMAIL: 'to@x.com' }));
  assert.equal(config.fromEmail, 'from@x.com');
  assert.equal(config.toEmail, 'to@x.com');
});

test('buildConfig throws listing every missing required variable', () => {
  assert.throws(
    () => buildConfig({ GMAIL_USER: 'me@example.com' }),
    /Missing required environment variable\(s\): GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, SUBJECT, TEXT/,
  );
});

test('sanitizeHeader strips CR/LF to block header injection', () => {
  assert.equal(sanitizeHeader('Subject\r\nBcc: evil@x.com'), 'Subject Bcc: evil@x.com');
});

test('sendEmail builds correct mail options and returns the result', async () => {
  let captured;
  const result = await sendEmail({
    env: validEnv(),
    createOAuthClient: fakeOAuthClient(),
    createTransport: () => ({
      sendMail: async (options) => {
        captured = options;
        return { messageId: '<abc@example.com>' };
      },
    }),
  });

  assert.equal(captured.from, 'me@example.com');
  assert.equal(captured.to, 'me@example.com');
  assert.equal(captured.subject, 'Hello');
  assert.equal(captured.text, 'Body');
  assert.equal(result.messageId, '<abc@example.com>');
});

test('sendEmail rejects when required env is missing', async () => {
  await assert.rejects(
    () => sendEmail({ env: { GMAIL_USER: 'me@example.com' }, createOAuthClient: fakeOAuthClient() }),
    /Missing required environment variable/,
  );
});

test('sendEmail rejects when the access token is null (revoked refresh token)', async () => {
  await assert.rejects(
    () =>
      sendEmail({
        env: validEnv(),
        createOAuthClient: () => ({ getAccessToken: async () => ({ token: null }) }),
        createTransport: () => ({ sendMail: async () => ({}) }),
      }),
    /Failed to obtain OAuth2 access token/,
  );
});

test('sendEmail propagates transporter failures (so the Action can exit non-zero)', async () => {
  await assert.rejects(
    () =>
      sendEmail({
        env: validEnv(),
        createOAuthClient: fakeOAuthClient(),
        createTransport: () => ({
          sendMail: async () => {
            throw new Error('SMTP 535 auth failed');
          },
        }),
      }),
    /SMTP 535 auth failed/,
  );
});
