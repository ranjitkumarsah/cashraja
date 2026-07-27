# Cash Raja — Google Play Launch Checklist

Package: `com.graduatedcoder.cashraja` · Audience: **18+** (India) · Category: Entertainment / Lifestyle.

> This is preparation guidance. Answer every Play Console questionnaire **truthfully**
> against what the app actually does — the mappings below reflect the current build.

## 1. Store listing
- [ ] Title, short + full description (state clearly: earn virtual coins, redeem
      for **digital gift cards**; **not** a job, not guaranteed income, coins have
      no cash value — matches the app's own disclaimers).
- [ ] App icon (gold "C" coin on indigo — `assets/icon/`), feature graphic, ≥2
      phone screenshots (home, game, rewards, redeem).
- [ ] Contact email: **support.cashraja@gmail.com**.
- [ ] Privacy Policy URL: **https://cashraja.graduatedcoder.in/privacy**
      (already published from the landing site; mirrors the in-app policy).

## 2. Data safety form (declare what the backend actually collects)
| Play category | Collected? | Notes |
| --- | --- | --- |
| Personal info — Email, Name | **Yes** | From Google Sign-In. |
| Personal info — Date of birth | **Yes** | 18+ attestation, stored server-side. |
| Location — Approximate | **Yes** | Derived from IP (coarse geo), fraud/eligibility. |
| Device or other IDs | **Yes** | Device id (fraud), advertising id (AdMob). |
| App activity | **Yes** | In-app actions (games, offers, ad views, streaks). |
| Financial info | **No** | No payments taken; coins are virtual, rewards are gift cards. |
| Messages / Contacts / Photos | **No** | Not accessed. |

- **Encrypted in transit:** Yes (HTTPS everywhere).
- **Data deletion:** Yes — in-app (Profile → Delete account) **and** a request
  URL (below). Gift-card codes are encrypted at rest (AES-256-GCM).
- **Shared with third parties:** Google (Auth/FCM), AdMob (advertising id).
  Offerwall networks apply only once integrated (v2) — declare then.

## 3. Account deletion (Play requires this for apps with accounts)
- In-app: **Profile → Delete account** → `DELETE /api/account` (anonymize-in-place;
  the coin ledger is preserved but de-identified for financial integrity).
- External URL for the Console "Data deletion" field: publish deletion steps on
  **https://cashraja.graduatedcoder.in/privacy** (or a dedicated
  `/delete-account` page) so users without the app installed can request it.

## 4. Content rating (IARC questionnaire)
- [ ] Complete the IARC questionnaire. Disclose: **contains ads**; simulated
      chance mechanics (scratch/spin) that award **virtual** coins with **no
      real-money wager and no cash payout** (rewards are gift cards only).
- [ ] Target age **18+**; set the audience & content page accordingly (this also
      aligns with AdMob and offerwall network terms + Play Families exclusion).

## 5. Ads
- [ ] Declare **"Contains ads"**. AdMob rewarded + banner are live (real ids via
      dart-define — see `docs/RELEASE.md`).
- [ ] AdMob: app-ads.txt not required for Play, but link the app in the AdMob
      console and confirm the real App ID matches the `ADMOB_APP_ID` build value.

## 6. Technical / policy
- [ ] `targetSdk` current (Flutter default; keep within Play's latest-1 window).
- [ ] **Release signing configured** (not debug keys) — see `docs/RELEASE.md` §1.
- [ ] Foreground behavior + `POST_NOTIFICATIONS` (Android 13+) rationale ready
      (transactional: coin credits, redemption status, streak reminders).
- [ ] No restricted permissions beyond notifications + internet.
- [ ] First track: **Internal testing** → Closed → Production. Test the full
      loop (sign-in → earn → redeem → admin-approve → push) on the release AAB.

## 7. Copy rules (avoid Play rejections)
- Don't imply guaranteed earnings/income or "real money". Use "rewards", "gift
  cards", "coins have no cash value" — consistent with in-app legal copy.
- No misleading "get rich" claims; keep screenshots representative of real UI.
