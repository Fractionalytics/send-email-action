# send-email-action

A composite GitHub Action to send an email from a workflow using [Nodemailer](https://nodemailer.com/) and Gmail OAuth2.

## Usage

Credentials are read from the **workflow `env` context** (export them from secrets);
the message is passed as **inputs**.

```yaml
jobs:
  notify:
    runs-on: ubuntu-latest
    env:
      GMAIL_CLIENT_ID: ${{ secrets.GMAIL_CLIENT_ID }}
      GMAIL_CLIENT_SECRET: ${{ secrets.GMAIL_CLIENT_SECRET }}
      GMAIL_REFRESH_TOKEN: ${{ secrets.GMAIL_REFRESH_TOKEN }}
      GMAIL_USER: ${{ secrets.GMAIL_USER }}
    steps:
      - uses: fractionalytics/send-email-action@v8 # pin to a tag or SHA
        with:
          to_email: someone@example.com   # optional, defaults to GMAIL_USER
          subject: Build succeeded
          text: The pipeline finished successfully.
```

## Inputs

| Input        | Required | Default      | Description                                  |
| ------------ | -------- | ------------ | -------------------------------------------- |
| `subject`    | yes      | —            | Email subject                                |
| `text`       | yes      | —            | Plain-text email body                        |
| `to_email`   | no       | `GMAIL_USER` | Recipient address                            |
| `from_email` | no       | `GMAIL_USER` | Sender (must be the Gmail user or an alias)  |

## Required environment variables (from secrets)

`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER`.

These come from a Google Cloud OAuth2 client; the refresh token is typically obtained
via the [OAuth2 Playground](https://developers.google.com/oauthplayground). Treat the
client secret and refresh token as long-lived send credentials — store them as repo
secrets and rotate them periodically.

The action exits non-zero (fails the step) if any credential is missing, the refresh
token is invalid, or delivery fails.

## Development

```bash
npm ci
npm test
```

## License

MIT
