# API

The `/v1` API that every client uses: the web app, an admin mobile app, and
some day customers. The route table is `apps/api/src/app.ts`. Keep this
file in step with it.

## Reaching it

| From | Base URL |
|---|---|
| Anything on the web | `https://attester.no/api/v1` |
| Directly | The API container's own address + `/v1` |

Both reach the same code. The first is a forwarder in the web app and is the
one to use unless you have a reason not to.

## Signing in

Sign in against Nhost Auth (email and password) with any Nhost client. That
gives an access token that lives about 15 minutes and a refresh token. Send
the access token on every call:

```
Authorization: Bearer <access token>
```

Refresh it before it expires. A `401` with `{"error":"Invalid session"}`
means the token is missing or expired.

## Errors

| Status | Body | Meaning |
|---|---|---|
| 400, 409, 413 | `{ "error": "..." }` | The request is wrong. The text is written for a reader |
| 401 | `{ "error": "Invalid session" }` | Sign in or refresh |
| 403 | `{ "error": "Forbidden" }` | Signed in, but not a member of this organisation |
| 404 | `{ "error": "..." }` | No such thing, or not in this organisation |
| 500, 502 | `{ "code": "server_error" }` | Our fault. Nothing more is said on purpose |

## What an admin app needs

All of these require membership of the organisation in the path.

| Call | Purpose |
|---|---|
| `GET /me/organizations` | The organisations the signed-in user administers: `{ organizations: [{ id, slug, name, role }] }` |
| `GET /org/:slug/submissions` | The queue. See below |
| `GET /org/:slug/templates` | Templates with `form_schema`, to label a submission's fields |
| `POST /org/:slug/submissions/:id/preview` | The PDF with a watermark. Registers nothing |
| `POST /org/:slug/submissions/:id/recipient-check` | `{ canReceive }`: can this one be sent to Digipost |
| `POST /org/:slug/submissions/:id/issue` | Issue the certificate. See below |
| `DELETE /org/:slug/submissions/:id` | Delete a submission and its data |
| `GET /org/:slug/certificates` | Issued certificates: ids, times and who issued. No personal data |
| `GET /org/:slug/settings`, `PATCH` | `{ digipostAvailable, digipostEnabled }` |

### The queue

```json
{
  "submissions": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "template_id": "uuid",
      "data": { "name": "..." },
      "created_at": "2026-11-13T10:00:00Z",
      "issued_at": null,
      "has_recipient": true,
      "delivery": null
    }
  ]
}
```

- `issued_at` set means the certificate is issued. The submission is deleted
  24 hours after that, so it disappears from this list.
- `has_recipient` means the volunteer asked for Digipost. The fødselsnummer
  is never returned.
- `delivery` is `null` or `{ "channel": "digipost", "status": "queued" |
  "sent" | "failed", "sentAt": ... }`.

### Issuing

```
POST /org/:slug/submissions/:id/issue
{ }                           issue only
{ "deliver": "digipost" }     issue and send to Digipost
```

```json
{
  "id": "certificate uuid",
  "alreadyIssued": false,
  "filename": "Ola Nordmann_attest.pdf",
  "verifyUrl": "https://attester.no/org/<slug>/verify?t=...&id=...",
  "pdf": "<base64>",
  "delivery": null
}
```

- The server renders the PDF and computes the hash. The client sends only the
  id.
- Safe to repeat. A second call returns the same certificate with
  `alreadyIssued: true` and a fresh PDF, and does not send to Digipost twice.
- With `deliver`, a `409` means Digipost is not possible for this submission
  and nothing was issued. Call `recipient-check` first and offer the choice
  only on `canReceive: true`.
- `delivery.status` `queued` means the certificate is issued but Digipost did
  not answer. It is retried for 24 hours.

## Public, no sign-in

| Call | Purpose |
|---|---|
| `GET /orgs` | Organisations shown on the front page |
| `GET /org/:slug` | `{ organization: { id, slug, name }, digipost }` |
| `GET /org/:slug/branding` | Logo for the public pages |
| `GET /org/:slug/offered-templates` | The certificate types a volunteer can choose |
| `GET /org/:slug/templates/:id` | One template's `form_schema`, for the form and the verify page |
| `POST /org/:slug/submissions` | A volunteer's submission: `{ templateId, data, nationalId? }`. `data` is a flat map of strings |
| `GET /org/:slug/certificates/verify?submissionId=` | `{ hash, template_id }` for the verify page |
| `POST /org-requests` | An organisation asking to be set up |

## The rest

Used by the web admin and unlikely to matter on a phone:
`/org/:slug/assets`, `/org/:slug/assets/:id`, template `POST`, `PATCH` and
`DELETE`, `/org/:slug/members`, `/org/:slug/invites`, `/invites/redeem`, and
`/admin/*` for the platform owner.

## Not part of this API

`/api/certificates/verify` is the frozen legacy endpoint for certificates
printed before 2026. It lives in the web app and must not change. See
CLAUDE.md.
