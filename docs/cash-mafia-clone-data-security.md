# Data & Security: Coin Rewards / Offerwall App (Cash Mafia Clone)

**Status:** Draft v1
**Owner:** Ranjit
**Related docs:** PRD, TRD, BRD (cash-mafia-clone-*.md)

---

## 1. Data Inventory — What the App Collects

| Data | Source | Purpose | Sensitivity |
|---|---|---|---|
| Google account (email, name, profile ID) | Firebase Auth (Google Sign-In) | Identity, single-account enforcement | High |
| Device ID / fingerprint | Client SDK | Fraud detection, multi-accounting prevention | Medium |
| IP address | Server-side, request headers | GEO detection, fraud/velocity checks | Medium |
| Coin ledger / transaction history | Internal | Core product function | Low (but tied to identity) |
| Gift card codes issued | Fulfillment API / manual inventory | Redemption delivery | **High** — treat as near-equivalent to cash |
| Ad/offerwall network identifiers (advertising ID, SDK-specific IDs) | Ad/offerwall SDKs | Required by networks for attribution/payout | Medium — shared with third parties |
| App usage/session data | Analytics (if added) | Engagement metrics | Low |

**Explicitly not collected in v1:** phone number, physical address, payment/bank details, government ID — the gift-card-only, Google-only design keeps the data footprint deliberately narrow.

---

## 2. Data Classification & Handling

| Class | Examples | Handling rule |
|---|---|---|
| Secret | Gift card codes, network HMAC keys, API keys | Encrypted at rest (AES-256), never logged in plaintext, masked in admin UI after first reveal |
| PII | Email, name, device ID, IP | Access-controlled, excluded from analytics exports, retained only as long as the account is active |
| Internal/operational | Ledger entries, offer completions, fraud flags | Access-controlled to backend/admin only |
| Public | Referral codes, gift card catalog | No special handling needed |

---

## 3. Play Store Data Safety Disclosure

- Must accurately declare: data shared with ad/offerwall networks (advertising ID, device ID), data collected (email via Google Sign-In), and purpose (analytics, fraud prevention, personalization/ads). Under-declaring this is a common takedown trigger for apps in this category.

---

## 4. Security Architecture

- **Transport:** TLS everywhere (API, admin panel, webhooks) — no exceptions, including internal service-to-service calls
- **Auth:** Firebase-issued Google ID tokens verified server-side (audience + issuer checked) before minting your own JWT; JWT short-lived with refresh token rotation
- **Admin access:** separate auth scope/audience from regular users; role-based access control (super-admin vs. support/reviewer roles) so redemption approvers don't automatically get balance-adjustment or offer-config rights
- **Webhook security:** offerwall postback endpoints verify HMAC signatures against each network's shared secret; reject anything unsigned or mismatched before touching the ledger
- **Secrets management:** all API keys, HMAC secrets, DB credentials in environment-managed secret storage (not committed to git, not in client-side Flutter code — the Flutter app should never embed offerwall/gift-card API secrets, only public SDK keys)
- **Encryption at rest:** gift card codes and any other secret-class data encrypted at the column level; database backups encrypted
- **Least privilege:** database roles scoped so the API service account can't drop tables or access unrelated schemas; admin panel service account separate from the mobile API service account where feasible

---

## 5. Fraud-Adjacent Security Controls

(Cross-referenced from TRD Section 5 — restated here as a security concern, not just a business-margin concern)

- Device fingerprinting + IP tracking to catch multi-accounting — this is both a fraud control *and* a security control, since farmed accounts are also the most likely vector for gift-card-code theft/resale
- Server-side verification (SSV) required for every ad reward and offer completion — never trust a client-reported "task complete" event to write to the coin ledger
- Rate limiting on all public endpoints, especially `/api/game/round-complete` and `/api/redemptions`, to blunt scripted abuse

---

## 6. Data Retention & Deletion

- Active user data retained for the life of the account
- On account deletion request: anonymize PII (email, name, device ID) in place rather than deleting ledger rows outright, since the ledger is also a financial/audit record for issued gift cards — deleting it entirely could remove your own fraud/dispute evidence. Anonymization preserves the audit trail while honoring the deletion request.
- Gift card codes: purge from the `redemptions` table (or re-encrypt-and-discard the key) once confirmed delivered and past any dispute window — no reason to retain live codes longer than necessary
- Define a concrete retention period (e.g., 24 months post account-inactivity) rather than "indefinite"

---

## 7. Incident Response (Minimum Viable Plan for v1)

- Any suspected gift-card-code leak or fraud spike → immediately disable the affected offer/network or pause redemption approvals, don't wait for root-cause before containing
- Maintain the `admin_audit_log` (from TRD) as the first place to check during an incident — every balance adjustment and redemption approval is already attributed to an admin with a reason
- Have a plan and a clear owner (you, at this stage) for notifying affected users of any data or gift-card-code breach before it's needed, not after

---

## 8. Open Items

- Decide concrete data retention windows (Section 6) rather than leaving them undefined
- Decide whether analytics (e.g. Firebase Analytics) gets added — if so, it needs to be reflected in the Data Safety disclosure before it ships, not after
