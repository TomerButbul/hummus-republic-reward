# Email verification codes — setup

Two Netlify Functions gate the Appfront signup behind a 6-digit code emailed to
the student's .edu address.

- `POST /.netlify/functions/send-code`   body: `{ email }`
- `POST /.netlify/functions/verify-code` body: `{ email, code }`

State lives in Netlify Blobs (no database). Codes expire in 10 minutes, allow
6 wrong guesses, and are capped at 5 sends per address per hour.
Only a SHA-256 of `email:code` is stored — never the code itself.

## 1. Resend
1. Create an account at resend.com
2. Add domain `mail.thehummusrepublic.com`
3. Paste the DNS records Resend gives you into **Cloudflare** (DNS is there, not GoDaddy)
4. Copy the API key (starts `re_`)

## 2. Netlify env vars
Site settings → Environment variables:

| Key | Value |
|---|---|
| `RESEND_API_KEY` | `re_...` |
| `MAIL_FROM` | `Hummus U+ <rewards@mail.thehummusrepublic.com>` |
| `ALLOWED_ORIGINS` | your live Framer domain(s), comma separated |

`*.framer.app` preview URLs are allowed automatically.

## 3. Framer
On `StudentLanding`: set **Email Code → Require**, and **Verify API Base** to
this Netlify site's URL.

## Test
```
curl -X POST https://<site>/.netlify/functions/send-code \
  -H 'content-type: application/json' -d '{"email":"you@school.edu"}'
```
