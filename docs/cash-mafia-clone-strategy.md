# Strategy: Coin Rewards / Offerwall App (Cash Mafia Clone)

**Status:** Draft v1
**Owner:** Ranjit
**Related docs:** PRD, TRD, BRD, Data & Security (cash-mafia-clone-*.md)

---

## 1. Positioning Strategy

- Lead with the game mechanic in the store listing (number/pattern recognition), with rewards as a secondary framing — this mirrors the reference app's approach and keeps the app inside Puzzle/Casual categorization
- Differentiate on **trust**, not features: the reference app's biggest recurring complaint across its portfolio is redemption thresholds being raised after the fact. A "fixed rates, no surprises" positioning is a genuine, defensible differentiator in a category where users are burned often and word-of-mouth (reviews, referral) is the primary growth channel
- Use an original app name, icon, and store copy — don't imitate Rayole Software's branding closely; this is also a practical differentiation move, not just a defensive one

---

## 2. Go-to-Market Strategy

- **Primary channel: referral-driven organic growth.** The category's economics work because CAC needs to stay near-zero — paid UA (user acquisition) at typical CPI rates is unlikely to pencil out against per-user offer/ad revenue at launch scale
- **Secondary channel: ASO (App Store Optimization).** Puzzle/rewards-app keyword competition is high but addressable — study the reference portfolio's listing keywords, screenshots, and description structure as a baseline, then differentiate on the trust angle from Section 1
- **Launch sequencing:** soft-launch to a small cohort (friends/family/existing Telegram channel audience, per your [[telegram-channel]] reach) to validate the offer/ad fill rates and fraud rules before wider release — this also lets you tune the coin-to-gift-card rate with real eCPM/CPA data rather than guesses, the same approach you used for the coin_to_usd_rate decision on the FoxiGrow-style app
- **Retention lever:** the daily streak + capped daily rewards structure (from PRD) is designed to build a habit loop; referral K-factor target (≥0.15) assumes redemption trust is high enough that users are willing to invite others

---

## 3. Competitive Landscape

- Direct competitors: Rayole Software's own portfolio (Cash Mafia, Cash Panda, Cash Romeo, Cash Jungle, Cash Thug) — essentially the same app re-skinned five times, which tells you the category tolerates (and rewards) low differentiation as long as the offerwall inventory and payout mechanics work
- Broader category: any GPT/offerwall app targeting India (various "earn money" apps) — most compete on offer volume and payout speed, not on UX polish
- **Your structural advantage, if you build it:** fixed, transparent gift-card thresholds and a cleaner fraud posture could reduce churn/negative-review rate relative to competitors — but this only matters if offer inventory (network access, fill rates) is competitive first. Don't over-invest in trust-differentiation before confirming basic offer supply works.

---

## 4. Branding

- Original app name, icon, and store screenshots, distinct from the reference portfolio's naming pattern ("Cash ___")
- The *mechanic* (number-pattern game + offerwall + gift cards) is common across the whole category — the differentiation opportunity is in trust/UX execution, not the mechanic itself

---

## 5. Vendor Relationships

- **Offerwall/ad networks** (Adjoe, AppLovin, Unity, AdMob, AdGate, OfferToro, CPX Research): standard developer sign-up, revenue-share terms — read each network's payout terms and minimum payout thresholds before integrating, these vary and affect your own cash flow timing
- **Gift card fulfillment** (Xoxoday/Qwikcilver/Cashfree): this is the one vendor relationship with real commercial terms (fees, minimum purchase commitments, settlement timelines) — get actual quotes before finalizing the BRD's cost structure, since "small per-card fee" was an estimate, not a confirmed number

---

## 6. Risk Register (Strategic)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Play Store delisting for category/positioning issues | Medium — happens periodically to similar apps in this space | Conservative store copy, avoid "guaranteed income" language, be ready to reposition if forced |
| User trust collapse from opaque rate changes | Medium — the single most common failure mode observed in the reference app | Fixed-rate policy (from BRD Business Rules), enforce it operationally |
| Offerwall network access/approval delays | Medium | Start network sign-up processes early, before build is finished |

---

## 7. Open Items

- Get actual fee/terms quotes from Xoxoday, Qwikcilver, and Cashfree before locking the cost model
- Finalize app name/branding, distinct from the reference portfolio
- Start offerwall/ad network developer account sign-ups early given approval timelines are outside your control
