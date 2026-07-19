# BRD: Coin Rewards / Offerwall App (Cash Mafia Clone)

**Status:** Draft v1
**Owner:** Ranjit
**Related docs:** PRD v1 (cash-mafia-clone-prd.md), TRD v1 (cash-mafia-clone-trd.md)

---

## 1. Business Objective

Build and operate an Android rewards app where users earn coins through offerwall tasks, rewarded ads, and light gameplay, redeemable for digital gift cards (Amazon, Flipkart, Google Play). Revenue comes from ad/offerwall network payouts (CPA/CPI/eCPM); the business is profitable when network payout per user exceeds the cost of coins redeemed as gift cards, at scale, across a large low-cost user base.

**This is a volume/margin business, not a product-differentiation business** — the reference app (Cash Mafia) and its ~5-app sibling portfolio from the same developer prove the model works at scale (3M+ combined installs) with a near-identical mechanic repeated across multiple listings. The opportunity is in execution efficiency (low build/operating cost, tight fraud control, good network fill rates) rather than novel features.

---

## 2. Background & Market Context

- The GPT (Get-Paid-To) / rewards-app category is large and active on Play Store; the reference developer (Rayole Software) runs 5+ near-identical apps (Cash Mafia, Cash Panda, Cash Romeo, Cash Jungle, Cash Thug) with a combined 4M+ installs since 2023
- Apps in this category are typically listed under **Puzzle/Casual Games** rather than Finance, using a thin gameplay layer (number-pattern recognition, in this case) as both a retention hook and a store-policy positioning choice
- User base skews toward Tier 2/3 India — users seeking small supplemental income opportunities in spare time
- Category risk: Play Store has periodically enforced against apps for misleading categorization, undisclosed data sharing, and "get rich" implied claims — this is an active policy risk area, not a settled one

---

## 3. Stakeholders

| Role | Responsibility |
|---|---|
| Product/Founder (Ranjit) | Product decisions, coin economy tuning, network relationships |
| Backend dev | Node.js API, ledger, fraud engine, admin panel (React) |
| Mobile dev | Flutter Android app, ad/offerwall SDK integration |
| Ad/offerwall network partners | Adjoe, AppLovin, Unity, AdMob, AdGate/OfferToro/CPX — revenue source |
| Gift card fulfillment partner | Xoxoday/Qwikcilver/Cashfree, or manual inventory — cost center |
| End users | Task completion, ad engagement — the traffic/attention supply side |

---

## 4. Business Rules

- Redemption is **gift card only** — no cash, bank transfer, or UPI/PayPal payout. This removes payment-compliance overhead (no direct money transmission) and keeps the business inside a simpler regulatory posture
- One Google account per user, tied to device fingerprint — no phone/email signup, no anonymous accounts
- Coin-to-gift-card conversion rates are **fixed at launch and not raised** without clear in-app notice — repeated threshold changes are the single biggest driver of negative reviews and distrust in the reference app's review history, and directly hurts retention/referral (K-factor) economics
- All redemptions manually reviewed before fulfillment in v1 — no automated instant gift-card issuance, to control fraud exposure while fraud rules are still being tuned
- Referral bonus is time-capped (not perpetual) to keep referral liability bounded and predictable

---

## 5. Cost Structure

| Item | Cost model |
|---|---|
| Backend/admin/mobile development | One-time build cost (internal/dev time) |
| Hosting (Node.js API, Postgres, Redis) | Ongoing, scales with DAU — low at launch scale |
| Firebase (Auth, FCM) | Free tier covers early-stage volume |
| Ad mediation (AppLovin MAX, Unity LevelPlay, AdMob) | Free to integrate — revenue share, no cost, these are income not expense |
| Offerwall SDKs (Adjoe, AdGate, OfferToro, CPX) | Free to integrate — revenue share, income not expense |
| **Gift card fulfillment** | **The one real variable cost** — either a small per-card fee/margin (API route: Xoxoday/Qwikcilver/Cashfree) or upfront float capital tied up in bulk-purchased codes (manual route) |
| Play Store developer account | One-time $25 |

**Net:** almost the entire stack is free to stand up. The business's actual unit economics hinge entirely on the spread between (a) what ad/offerwall networks pay per completed action and (b) the coin-equivalent cost of the gift card eventually redeemed for that activity, net of breakage (coins earned but never redeemed).

---

## 6. Revenue Model

- **Offerwall CPA/CPI payouts** — per completed task (survey, app install + playtime via Adjoe, signup, etc.)
- **Rewarded video ad eCPM** — per ad view, mediated across AppLovin MAX / Unity LevelPlay / AdMob for best fill and rate
- Revenue is realized per-user-action; cost (gift card value) is only realized when a user actually redeems, and only a fraction of earned coins typically get redeemed (breakage) — this gap is the core margin

---

## 7. Success Criteria (Business-Level)

| Metric | Why it matters | v1 target (90 days) |
|---|---|---|
| Installs | Top-of-funnel volume | 50K |
| DAU/MAU | Engagement quality, drives ad/offer inventory consumption | ≥ 20% |
| Redemption rate | Controls gift-card liability | 15–30% of earned coins |
| Referral K-factor | Organic growth, lowers CAC | ≥ 0.15 |
| Net margin per DAU (network payout − gift card cost, amortized) | The actual business health metric | Positive by month 2–3 |

---

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Play Store policy enforcement (miscategorization, data disclosure) | App takedown | Accurate Data Safety disclosure, avoid "guaranteed income" language, be ready with a Finance-category-compliant fallback listing |
| Fraud (multi-accounting, offer/ad farming) | Direct margin loss via unearned gift-card payouts | Device fingerprinting, velocity rules, server-side ad/offer verification (never trust client-reported completions) |
| Offerwall network access/approval | No offer inventory = no revenue | Confirm India-based developer account access to Adjoe/AdGate/OfferToro/CPX before committing build time |
| Gift card liability exceeding cash on hand | Can't fulfill approved redemptions | Manual approval gate in v1, conservative breakage assumptions, monitor outstanding liability on the admin dashboard |
| User trust erosion from threshold changes | Bad reviews, churn — directly hurt the reference app | Fixed rates policy (see Business Rules), transparent in-app comms |

---

## 9. Out of Scope (Business Decisions, v1)

- No cash/bank payout methods
- No iOS version at launch
- No markets outside India at launch (gift card catalog is India-specific: Amazon.in, Flipkart, Google Play India)
- No automated/instant gift-card issuance

---

## 10. Open Business Decisions

- Gift card sourcing route (API/reseller fee vs. manual bulk-purchase float capital) — this is the single biggest cost-structure decision left unresolved and should be settled before Phase 1 build starts
- Initial marketing motion — paid installs vs. referral-only organic growth for launch
- Whether to register a distinct developer/publisher identity from any existing apps, given the category's policy scrutiny
