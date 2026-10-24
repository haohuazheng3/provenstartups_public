# ProvenStartups

**AI startup ideas with revenue receipts.** — [provenstartups.com](https://provenstartups.com)

Most startup idea lists quote a revenue figure and stop there. You never learn whether the
number came from a dashboard someone could check, or from a founder describing their own
business on a podcast. Those two are not the same claim, but they get repeated the same way.

ProvenStartups indexes businesses that already make money and labels every figure with where
it came from.

## The evidence grades

Every revenue number in the index carries one of four labels:

| Grade | What it means |
|---|---|
| ✅ Third-party verified | A source outside the business confirmed it — a marketplace payout page, an acquisition listing, a filing |
| 🗣 Founder-reported | The operator stated it, often with a dashboard on camera. Unaudited, usually revenue rather than profit |
| 📎 Creator-relayed | A YouTuber or writer reported someone else's number. Two links from the money |
| ❓ Unproven | A figure with no attached artefact at all |

Across the current index of 406 businesses the split is **57 third-party verified, 184
founder-reported, 121 creator-relayed, 44 unproven**. Roughly one in seven revenue claims in
this space can actually be checked by someone other than the person making it.

We also keep **38 documented failures**. Most directories drop those, because a list of things
that did not work converts worse than a list of things that printed money. They are the most
useful entries we have.

One honest caveat: the index over-represents businesses that succeeded and then chose to
publish numbers. Use it to compare models, not as a forecast for yours.

## How each entry is built

1. **Transcribe the source in full** — founder interviews, creator breakdowns, case studies.
   Not skimmed; captured whole.
2. **Grade the evidence** — every figure gets a source class. Cases whose numbers contradict
   themselves get cut rather than smoothed over.
3. **Reduce to a playbook** — difficulty scores, acquisition channels, and the source video and
   transcript attached so you can check the work.

Free to read, no paywall on the breakdowns.

## Running it yourself

This repository holds the whole application — Next.js 16 App Router on TypeScript and
Tailwind v4, Drizzle over Postgres, Clerk for auth, Stripe for subscriptions. It deploys as-is.

```bash
git clone https://github.com/haohuazheng3/provenstartups_public.git
cd provenstartups_public/site
npm install
cp ../.env.example .env.local     # then fill it in
npx drizzle-kit migrate           # creates the schema
npm run dev
```

`.env.example` lists every variable with a note on what it is for. Three are enough to get a
page rendering: `DATABASE_URL`, the two Clerk keys. Stripe is only needed for the paid tier,
and the mail webhook can stay empty — outbound mail queues rather than failing.

Two things bite on a fresh deploy, both learned the hard way:

- **Use the pooled Postgres connection string** (its host contains `-pooler`). A direct
  connection exhausts the pool under serverless.
- **`NEXT_PUBLIC_LAUNCHED` gates the noindex.** Until it is `1`, every page ships
  `noindex` from three places at once. That is deliberate — it keeps preview deployments out
  of the index — but it means a real launch needs that variable set.

For Vercel, set the project's root directory to `site`.

### What is not in here

The database starts empty: the indexed businesses and the published articles are data, not
code, and they stay in the private repository. The app handles that — `loadPosts()` returns an
empty list when no content is present, so the blog renders as an empty section rather than
breaking the build.

Also absent, by design: credentials, the keyword research, and the operating records. Files
reach this repository through an explicit allowlist — the publish job starts from an empty
directory and copies in only what is named, so anything unlisted is absent by default rather
than by remembering to exclude it.

### The ops scripts

Three standalone tools sit in `scripts/`, useful outside this project:

| Script | What it does |
|---|---|
| `gsc_setup.py` | Adds a domain to Google Search Console and submits its sitemap through the API — DNS verification included, no console clicking |
| `indexnow.py` | Pushes every URL in a sitemap to IndexNow, which fans out to Bing, Yandex, Seznam and Naver in one call |
| `svg2png.mjs` | Rasterises SVG to PNG at exact dimensions via headless Chromium. `qlmanage -s` scales to the longest edge and distorts anything that isn't square |

## Links

- Site — <https://provenstartups.com>
- Method — <https://provenstartups.com/how-it-works>
- All ideas — <https://provenstartups.com/projects>
- Contact — contact@provenstartups.com
