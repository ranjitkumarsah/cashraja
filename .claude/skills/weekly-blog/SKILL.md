---
name: weekly-blog
description: Write ONE new SEO blog post for the Cash Raja marketing site. Adds the post to the blog data files (which auto-register into prerender + sitemap) and verifies the build. Does NOT commit or push — the owner reviews and pushes to GitHub manually. Use for the weekly blog cadence or whenever asked to write a Cash Raja blog article.
---

# Weekly blog writer (Cash Raja)

Write exactly ONE new, honest, SEO-focused blog article each run, matching the
existing house style, and verify the build. Do NOT commit or push — leave the
changes for the owner to review and push manually. Keep it truthful: Cash Raja is
a rewards app for India (18+), rewards are verified server-side, coins redeem
only for Amazon/Flipkart/Google Play gift cards, coins have no cash value, and it
is NOT a job or guaranteed income. Never invent stats, ratings, testimonials, or
payout guarantees.

## Files you will touch
- `admin/src/features/blog/posts-meta.ts` — append a `BlogPostMeta` object to `BLOG_POSTS`.
- `admin/src/features/blog/posts-content.tsx` — add a `POST_BODIES['<slug>']` JSX body.
- (No other files — seo-config, routes, sitemap, and the /blog index pick up new posts automatically.)
- Reference: `docs/seo-keyword-map.md` for target keywords.

## Steps
1. **Pick the next topic.** Read `posts-meta.ts` to see which slugs already exist.
   From the Backlog below, choose the FIRST topic whose slug is not yet present.
   If every backlog topic is published, invent a fresh, non-duplicate topic that
   fits the keyword map (an India rewards/gift-card intent), with a new slug.
2. **Match the style.** Read one existing entry in both `posts-meta.ts` and
   `posts-content.tsx` so the new one matches structure and tone exactly.
3. **Add the metadata** to `BLOG_POSTS` (append, keep newest first is fine but
   appending is OK): `slug`, `title` (ends with " — Cash Raja"), `h1`,
   `description` (~150 chars, includes the primary keyword + "India"), `excerpt`
   (one line), `date` and `updated` (today's date in `YYYY-MM-DD` — use the
   current date from context), `readingMinutes` (4–6), `keywords` (3 items).
4. **Write the body** in `posts-content.tsx` under `POST_BODIES['<slug>']`:
   - 500–900 words, genuinely useful, in `en-IN` English.
   - Open with a short lead `<p className="text-ink-muted">…</p>`.
   - Use `<Section title="…">…</Section>` (imported from `../public/marketing`)
     for each subheading; use `<InternalLink to="…">…</InternalLink>` to link to
     relevant pages (`/how-to-earn`, `/free-gift-cards`, `/free-amazon-gift-card`,
     `/free-flipkart-gift-card`, `/free-google-play-gift-card`, `/refer-and-earn`,
     `/faq`) — 2–4 internal links per article.
   - End with an honest expectation-setting paragraph.
   - Escape apostrophes in JSX text as `&apos;` and quotes as `&ldquo;/&rdquo;`.
5. **Verify.** From `admin/`, run `npm run build`. Confirm TypeScript passes and
   the log shows `prerendered /blog/<slug> -> …`. Fix any error before finishing.
6. **Do NOT commit or push.** Leave the two edited files in the working tree for
   the owner to review. (The owner commits and pushes to GitHub manually.)
7. **Report** for the owner:
   - the new slug + title, and the two files changed,
   - the local URL to preview: `/blog/<slug>` (and the live URL once pushed:
     `https://cashraja.graduatedcoder.in/blog/<slug>`),
   - a ready-to-use commit line, e.g. `git add -A && git commit -m "Blog: <title>"`,
   - a reminder to Request Indexing for the new URL in Search Console after push.

## Guardrails
- Write only ONE post per run.
- Do not modify routing, seo-config, sitemap, or any app/admin/backend files.
- NEVER run `git commit` or `git push` — the owner handles publishing.
- If the build fails, fix it or report the error; do not leave a broken build.
- Keep every claim honest and policy-safe (no fabricated ratings/earnings).

## Backlog (pick the first unpublished slug)
1. `how-to-redeem-coins-for-gift-cards` — kw: "how to redeem coins for gift cards"; walk through the Rewards store + review + delivery.
2. `free-amazon-pay-balance-india` — kw: "free amazon pay balance"; earning Amazon Pay balance via gift cards.
3. `google-play-redeem-code-free-guide` — kw: "google play redeem code free"; what the code does + how to earn it.
4. `avoid-reward-app-scams-india` — kw: "reward app scams india"; red flags + why verified rewards matter (trust/E-E-A-T).
5. `daily-rewards-and-streaks-tips` — kw: "daily rewards app"; using daily bonuses + streaks to earn steadily.
6. `survey-tips-to-earn-more-coins` — kw: "earn more from surveys"; qualifying + answering honestly.
7. `how-long-do-gift-card-redemptions-take` — kw: "gift card redemption time"; review + delivery expectations.
8. `are-reward-apps-worth-it-india` — kw: "are reward apps worth it"; honest pros/cons.
9. `flipkart-gift-card-uses-india` — kw: "flipkart gift card uses"; what to buy + how to redeem on Flipkart.
10. `earn-gift-cards-in-your-spare-time` — kw: "earn in spare time"; low-effort earning habits.
11. `referral-tips-to-maximise-bonus` — kw: "refer and earn tips"; sharing effectively (rules-compliant).
12. `beginners-guide-to-cash-raja` — kw: "cash raja beginner guide"; first-week walkthrough.
