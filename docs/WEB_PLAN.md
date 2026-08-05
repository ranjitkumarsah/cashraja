# Cash Raja — Web User App + SEO Plan

**Goal:** a responsive **web version for users** (earn coins → redeem gift cards, the
same journey as the Android app), served at the site root `/`, with `/admin/*`
reserved for admins. Plus make all public pages **SEO- and India-geo-friendly** so
they rank on Google. Mobile-first, fast, accessible.

---

## 1. Two hard problems (decide these first)

### 1a. Rewarded ads don't exist on the web
The whole app earn loop is "watch a rewarded video → claim coins" (AdMob). **AdMob
has no rewarded-video product for the mobile web.** So the web can't copy the app's
ad-gated games/scratch/spin one-to-one. The web earn model must lean on **task-based
sources that DO work on web**:

| Earn source | App | Web | Notes |
|---|---|---|---|
| Offerwall (PlaytimeAds) | native SDK | ✅ **web iframe wall** | PlaytimeAds has a hosted web wall — perfect for web |
| Surveys (BitLabs/Pollfish/CPX-style) | webview | ✅ iframe | strong web earner |
| Manual offers + text proof | ✅ | ✅ same backend | already built |
| Referrals | ✅ | ✅ same | great for web virality + SEO backlinks |
| Rewarded video (AdMob) | ✅ core | ❌ n/a on web | — |
| Games / Scratch / Spin | ✅ ad-gated | ⚠️ needs a gate | no rewarded video to gate them |

**Recommended web earn model (v1):** primary earn = **offerwall + surveys + manual
tasks + referrals** (all genuine tasks, consistent with your "no reward without a
task" rule). Games/scratch/spin come to web in a later phase, gated by an
offer/survey completion instead of a video ad. Display ads (Google AdSense
banner/interstitial) can run for extra revenue but never gate a reward.

> This keeps the web money-safe and shippable without a rewarded-video hack.

### 1b. SEO needs pre-rendered HTML
The current React app is **client-side rendered (Vite SPA)** — Google can execute JS
but indexes CSR slowly/unreliably, and rich results need HTML in the response.
**Fix:** pre-render the *public* pages to static HTML at build time
(`vite-react-ssg` / prerender), while the logged-in app + admin stay a normal SPA
(they don't need SEO — they're behind auth). One build, still bundled and served by
the backend on Render, no new server.

---

## 2. Architecture & routing

One React app (current stack: Vite + React Router + Tailwind + TanStack Query),
served by the NestJS backend on the same origin. Three zones:

| Zone | Routes | Rendering | Indexed? |
|---|---|---|---|
| **Public / marketing** | `/`, `/about`, `/faq`, `/privacy`, `/terms`, `/how-to-earn`, `/rewards-catalog`, blog/help | **SSG** (static HTML, SEO) | ✅ yes |
| **User web app** | `/home`, `/earn`, `/games`, `/wallet`, `/rewards`, `/invite`, `/inbox`, `/profile` | SPA (auth-gated) | 🚫 `noindex` |
| **Admin** (unchanged) | `/admin/*` | SPA | 🚫 `noindex` |

- `/` = the marketing landing (public, indexed). A signed-in visitor is client-side
  redirected into `/home`. Crawlers/logged-out always get the SSG marketing HTML.
- Auth on web: **Firebase Google Sign-In (web SDK)** → the *same* backend
  `/api/auth/google` + 18+ attestation + referral. No backend auth changes needed.
- Session: JWT access + refresh in `localStorage` (or httpOnly cookie — see risks).

---

## 3. Feature parity map (app → web)

| App feature | Web v1 | Notes |
|---|---|---|
| Google Sign-in + 18+ attestation + referral entry | ✅ | Firebase web SDK → same endpoints |
| Home (balance, streak, CTAs) | ✅ | responsive dashboard |
| Earn: offerwall | ✅ | PlaytimeAds web iframe wall |
| Earn: surveys | ✅ | survey-wall iframe (pick a web survey partner) |
| Earn: manual offers + proof | ✅ | reuse H5 backend |
| Wallet (balance + full ledger history) | ✅ | reuse endpoints |
| Rewards store (brand → denom → redeem) + history | ✅ | reuse endpoints |
| Invite & earn (share link, stats) | ✅ | web share + copy link |
| Inbox (notifications) | ✅ | list; web push optional (phase 2) |
| Profile / settings / delete account | ✅ | reuse endpoints |
| Games / Scratch / Spin | ⏭️ phase 2 | need a non-video gate on web |
| Rewarded-ad watch | ❌ | not on web |

**Backend:** essentially **no new endpoints** for v1 — the web reuses the existing
user API. The only additions are (a) a public stats endpoint (already built) and
(b) any web-specific survey-partner callback (like the Playtime one).

---

## 4. SEO & India-geo plan

**On-page (every public page):**
- Unique `<title>` + meta description; canonical URL; Open Graph + Twitter cards.
- **JSON-LD structured data:** `Organization`, `WebSite` (+ SearchAction),
  `FAQPage` (on FAQ), `BreadcrumbList`, `SoftwareApplication` (for the Android app),
  `AggregateRating` only if real.
- Semantic HTML, one `<h1>` per page, descriptive headings, alt text.

**Site-level:**
- `sitemap.xml` (auto-generated) + `robots.txt` (allow public, disallow `/app`,
  `/admin`, `/api`).
- Fast Core Web Vitals: static HTML, inlined critical CSS, lazy images (WebP/AVIF),
  minimal JS on public pages, preconnect to fonts.
- Mobile-first responsive (Google mobile-first indexing) — most India users are on
  phones.

**India geo-targeting:**
- `hreflang="en-IN"` + `lang="en-IN"`; ₹ currency, India-relevant copy/examples.
- Google Search Console: submit sitemap, set India geo-target, verify.
- Content pages that target real search intent: "earn free Amazon gift cards in
  India", "best rewards app India", "how to get Google Play credit free", a
  **/how-to-earn** guide, an expanded **/faq**, and a small **/blog** or **/help**
  for long-tail keywords. This is what actually drives organic ranking.
- **GEO / AI-search (bonus):** clear, factual, well-structured content + FAQ schema
  also helps surfacing in Google AI Overviews / ChatGPT-style answers.

**Analytics:** GA4 + Search Console + basic event tracking (sign-up, earn, redeem).

---

## 5. UX / design / responsive
- Reuse the **Raja theme** (royal indigo + gold, Manrope/Inter) for brand
  consistency with the app and admin.
- Mobile-first: bottom-nav or hamburger on phones, sidebar on desktop.
- Fast, thumb-friendly, high-contrast (accessibility → also SEO).
- Trust signals on the landing (real stats, gift-card brands, "18+", "coins have no
  cash value", privacy link) — matters for a money app + for Play/AdSense policy.

---

## 6. Phases

- **W1 — SEO-ready public site (SSG):** convert public routes to static generation;
  add meta/JSON-LD/sitemap/robots/OG; India geo; content pages (how-to-earn, FAQ,
  help); performance pass; GA4 + Search Console.
- **W2 — Web auth & shell:** Firebase web Google Sign-In + attestation + referral;
  responsive signed-in shell + nav; route guards; token/refresh handling.
- **W3 — Earn (web):** offerwall (Playtime web wall) + surveys + manual offers +
  referrals.
- **W4 — Wallet & redeem:** wallet + full ledger; rewards store + redemption +
  history; inbox.
- **W5 — Polish & launch:** responsive/cross-browser QA, a11y, analytics, sitemap
  submit, soft launch. (Games/scratch/spin = later phase.)

---

## 7. Open decisions (need your call)
1. **Web earn model** — go with task-based (offerwall + surveys + manual + referral)
   for v1, games/scratch/spin later? (Recommended.)
2. **Survey partner for web** — reuse Playtime only, or add a survey wall (BitLabs /
   Pollfish / theoremreach)? (Can start with Playtime web wall alone.)
3. **Session storage** — `localStorage` (simple) vs httpOnly cookie (safer against
   XSS). Recommend localStorage for v1 parity with the app, revisit later.
4. **Scope order** — SEO landing/public site first (fast SEO win), then the full
   signed-in web app? (Recommended: W1 first.)

## 8. Risks
- SEO takes weeks/months to rank — set expectations; content quality matters most.
- Offerwall/survey web fill for India varies — same caveat as the app.
- SSG adds a little build complexity — mitigated by `vite-react-ssg` (no new server).
- Keeping web + app + admin visually consistent — reuse the shared theme + UI kit.
