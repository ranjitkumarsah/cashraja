# admin-auth module (A4.7)

Admin authentication, fully separate from app-user auth (distinct secret AND
JWT audience — see `src/common/auth/`):

- `POST /api/admin-auth/login` — email + bcrypt password. Returns
  `{ totp_required, challenge_token }` when TOTP is configured, or
  `{ totp_setup_required, challenge_token, otpauth_url }` for a fresh admin
  (secret rides inside the signed 5-minute challenge, persisted only after the
  first valid code).
- `POST /api/admin-auth/totp` — verifies the code, issues the admin JWT
  (aud=`admin`, role claim, 8 h).
- `POST /api/admin-auth/totp-setup` — first-code verification + secret persist.

All three endpoints are strictly throttled. Failed logins are logged without
credential material.
