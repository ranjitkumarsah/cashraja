# auth module (A4)

App-user authentication:

- `POST /api/auth/google` — Firebase ID-token exchange (driver behind
  `FIREBASE_VERIFIER`: `mock` accepts `mock:<uid>:<email>`, `firebase` uses the
  Admin SDK). Upserts the user (generated unique `referral_code`, GeoIP country
  from `CF-Connecting-IP`/`X-Forwarded-For`), upserts the device row, records
  the referral linkage row for new users, and issues an access JWT
  (aud=`app`, 15 m) plus an opaque refresh token (SHA-256 hash stored, 30 d).
  Banned users get 403.
- `POST /api/auth/refresh` — rotation with reuse detection: presenting a
  revoked or already-rotated token revokes every live token of that user.

Guards/decorators live in `src/common/auth/`. Coin movements must go through
LedgerService.record(); no module writes coin_ledger directly.
