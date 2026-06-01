---
name: virtuoso-image-sourcing
description: >-
  Source vetted, hotlink-safe property photos for Chelo Travel proposals using
  Marcelo's authenticated Virtuoso advisor portal session via the Claude for
  Chrome browser tool, validate that each candidate image URL loads anonymously
  (no cookies, cross-site referer) BEFORE writing it to the Notion Asset record.
  Use when a property is missing images, has fewer than 5 usable photos, or a
  generated proposal shows "IMAGE PENDING" placeholders — especially for chain
  hotels (IHG, Accor, Marriott, Hilton) whose official sites block automated
  crawls with 403s.
---

# Virtuoso Image Sourcing

Fill missing property images by harvesting them from the **Virtuoso advisor
portal** — where the imagery is professionally shot, chain-approved, and
licensed for advisor-built client materials — using Marcelo's live, logged-in
browser session, and **prove every URL is hotlink-safe before it touches
Notion.**

This is an **on-demand recovery skill**, not part of the generation pipeline.
The proposal generator stays unaware of it: when a proposal renders
"IMAGE PENDING", Marcelo invokes this skill from chat, it fills the missing
images, and he regenerates. It lives in the CheloTravel Claude Project as a
skill — it is **not** wired into `prompts/proposal-generator.md`.

## How Marcelo invokes it

In plain chat, when a proposal comes back with placeholders, e.g.:
- "The Basque proposal has image pending — source the photos from Virtuoso."
- "Find images for the Regent Porto Montenegro and add them to Notion."
- "Fix the missing hotel photos on the Abramzon proposal."

Marcelo names the proposal or the properties; the skill does the rest and tells
him when he can regenerate.

## Why this skill exists

The automated crawl in `prompts/proposal-generator.md` (tier-2) fails on chain
hotels: their sites return 403 to bots and serve JS-rendered, hotlink-protected
galleries. The result is the cream "IMAGE PENDING" placeholder. This skill
solves both halves of that problem:

1. **Access** — Claude for Chrome operates *inside* Marcelo's authenticated
   browser, so the Virtuoso portal (and chain galleries) load normally. No 403.
2. **Trust** — a URL that loads in Marcelo's browser may still be
   hotlink-protected for the public proposal. So every candidate is validated
   from a **clean, un-authenticated context** before it is accepted.

## The one rule that makes this work

> **Extract authenticated, validate anonymously.**
> Chrome (with Marcelo's cookies) finds the image URLs. The validator
> (`scripts/validate_image.py`, run in the code-execution sandbox with **no**
> cookies) decides whether they survive. Never validate from inside the browser
> session — his Virtuoso cookies would mask hotlink protection and you'd write a
> URL that 403s the moment it's embedded on the public proposal.

## Prerequisites

- **Claude for Chrome** browser tool available, with Marcelo signed in to the
  Virtuoso advisor portal in an open tab. If the browser tool is not available,
  fall back to the manual flow at the end.
- **Notion MCP** connected (to read the Asset records and write images back).
- A list of properties needing images — either passed in, or the assets the
  proposal generator flagged with `image_status: "missing"`.

## Workflow

### 1. Determine what's missing
Read the target Asset records in Notion. Queue any property with **0–4 usable
images** (the proposal generator wants ≥5). List them for Marcelo before
starting.

### 2. Locate each property in Virtuoso (Chrome, authenticated)
For each queued property, in Marcelo's logged-in browser:
- Navigate to the property's Virtuoso page (search the portal by hotel name +
  city). Confirm with Marcelo it's the right property if there's any ambiguity.
- Open the photo gallery / media section.
- Extract the **direct image-file URLs** — the actual `.jpg/.png/.webp` the CDN
  serves, not the gallery *page* URL. Pull from `<img src>`, `srcset` (take the
  largest candidate), and any lightbox/`data-*` full-res attributes. Prefer
  hero/exterior, a signature suite/room, dining, pool/spa, and a signature view.
  Aim for 6–10 candidates so enough survive validation.
- **Virtuoso's CDN is the easy case.** Asset URLs on
  `virtuoso-prod.dotcms.cloud/dA/<id>/<field>/<file>` are dotCMS binary-delivery
  links that serve publicly and have tested **hotlink-safe** — reference them
  directly, no download/rehost needed (still validate each in step 3). Note the
  CDN also serves `featuredVideo` `.mp4` assets: those are **videos**, not
  stills — the validator returns `video`, and they go in a `<video>` hero, never
  an `<img>` slot.

### 3. Validate anonymously (clean sandbox — NOT the browser)
Pass the candidate URLs to the validator in the code-execution context:

```bash
echo '["<url1>","<url2>", ...]' | python scripts/validate_image.py -
```

It requests each URL with **no cookies** and a cross-site `Referer`, exactly as
the public Vercel-hosted proposal will. Each result is one of:
- `safe` — loads as a real image anonymously → eligible for Notion.
- `video` — loads fine but is a video (e.g. a Virtuoso `featuredVideo` `.mp4`) →
  not for an `<img>`; skip, or store for a `<video>` hero if wanted.
- `protected` — 403/401, or bounced to HTML (login/homepage) → do NOT store the
  URL; route to the "own the bytes" fallback in step 4.
- `broken` — dead, non-image, or too small (stub/tracker) → discard.

Keep only `safe` URLs (and any `video` you deliberately want). Stop once you
have 5–8 stills per property.

### 4. Handle the `protected` ones — own the bytes
Even Virtuoso/CDN URLs can be hotlink-protected. When a wanted image is
`protected` but valuable:
- In Chrome, **download the image file**, then **rehost bytes we control** —
  commit it into the proposals repo asset folder (e.g.
  `proposals/assets/<asset-slug>/<name>.jpg`, served by Vercel). Store that
  durable URL on the Asset record.
- **Do NOT** store a Notion-attachment URL as the live `src`: Notion file URLs
  are signed and **expire (~1h)**, so they break in a standing HTML proposal.
  Uploading the file to Notion for *archival* is fine; the **live src** must be
  a durable, anonymously-loadable URL (our rehosted copy or a `safe` direct
  URL).

### 5. Show Marcelo, then write to Notion (human-in-the-loop)
Before writing, show Marcelo the shortlist (thumbnails/URLs + verdicts) and get
a yes — this mirrors the "Asset Approval Gate" in `PLAN.md`. On approval, write
the `safe`/rehosted URLs onto the property's Notion Asset record (the image
fields), and set/clear the missing-image flag so the next generation lands in
tier-1.

### 6. Report
Summarize per property: how many `safe` images stored, how many `protected`
were rehosted, and anything still unsourced (so it stays on the proposal
generator's "⚠ Images to source" TODO). Tell Marcelo he can now regenerate the
proposal.

## Guardrails

- **Every** image must depict the **actual property** — never generic stock
  (no Unsplash/Pexels/Pixabay). Same rule as `proposal-generator.md`.
- A URL reaches Notion **only** after a `safe` verdict from the anonymous
  validator. No exceptions — this is the whole point of the skill.
- Respect Virtuoso's asset-usage terms: these images are for advisor-built
  client materials. If unsure whether public web posting is covered, flag it to
  Marcelo rather than assuming.
- Don't re-crawl properties that already have ≥5 `safe` images on record.

## Fallback (no browser tool)
If Claude for Chrome isn't available: ask Marcelo to open the Virtuoso property
gallery himself, copy 6–10 direct image URLs (or download the files), and paste
them in. Then run steps 3–6 unchanged — validation and the Notion write are
identical. The validator is the durable part of this skill; the browser is just
the most convenient way to reach the URLs.
