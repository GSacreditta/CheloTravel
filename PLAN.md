# CheloTravel Platform — Final Plan

## Context
Chelo Travel is Marcelo Rosen's solo luxury travel agency (Miami, Virtuoso partner). **Claude Chat IS the application** — no custom app, no scripts, no framework. Marcelo (zero technical expertise) operates the entire system through Claude Chat, which reads/writes Notion (data) and pushes HTML to GitHub (deploy). Gabriel sets up everything; Marcelo just talks to Claude.

## Architecture

```
[Marcelo in Claude Chat]  ◄── Project prompts / custom instructions
    │
    ├──► [Notion MCP]   ←→  Clients / Trips / Assets / Proposals DBs
    │
    └──► [Google Drive MCP]  ──► writes HTML directly into  Propuestas/ (Drive folder, cloud)
                                       │
                                       ▼
                          [Google Apps Script]   (time trigger, every 5 min)
                                       │  runs as Gabriel's Google account (no service account)
                                       │  PUTs new/changed files via GitHub Contents API
                                       ▼
                          GitHub repo  →  Vercel auto-deploy  →  Live URL (~5 min total)
```

**Three layers:**
1. **Data:** Notion databases (Clients, Trips, Assets, Proposals) — read/write via Notion MCP
2. **Logic:** Claude Chat with project prompts — Client Intake, Trip Builder, Proposal Generator
3. **Output:** Stage-aware HTML proposals — written directly to Drive via Drive MCP, synced to GitHub by a cloud workflow, auto-deployed by Vercel

**Deploy pipeline (Marcelo's Mac runs only Claude + Notion — nothing else, ever):**
1. Claude Chat generates HTML proposal
2. Claude writes the HTML directly into the `Propuestas` Drive folder via the Drive MCP — no download, no save step
3. A Google Apps Script (running every 5 min as Gabriel's Google account) lists the Drive folder, compares each file's content with the version already in GitHub, and PUTs new/changed files via the GitHub Contents API
4. Vercel auto-deploys on push (~30 seconds)
5. Claude tells Marcelo the live URL immediately (URL is deterministic; total latency to live is ~5 min)
6. Claude updates Notion: Proposals DB record + Trip Card with URL + version history

**Note:** GitHub MCP does NOT work reliably on claude.ai web (known platform limitation — see [Issue #549](https://github.com/github/github-mcp-server/issues/549)). The Drive → GitHub Actions bridge bypasses this entirely and removes any local watcher.

**Live infrastructure (operational as of April 2026):**
- GitHub repo: `CheloTravel/Proposals` (private) — receives commits from the Apps Script sync
- Vercel project: `chelotravel` (Hobby plan, deployment protection OFF)
- Vercel ↔ GitHub: connected, auto-deploy on push verified
- Current domain: `chelotravel-sternbergg-4583s-projects.vercel.app`
- Source folder: `Propuestas/` in Google Drive (cloud) — shared with GCP service account (read) and with Marcelo's Drive MCP (write)
- Proposal URLs: `https://{domain}/proposals/{client-slug}-{destination}-v{N}.html`
- **TODO:** Set up custom domain `proposals.chelotravel.com` (or similar) in Vercel dashboard → Settings → Domains. Requires DNS CNAME pointing to `cname.vercel-dns.com`.

**MCP Connectors (Claude Chat):**
- **Notion MCP** — CheloTravel workspace (read/write all 4 databases)
- **Google Drive MCP** — write proposal HTML into `Propuestas/` folder
- **GitHub MCP is NOT used** — sync handled by an Apps Script project owned by Gabriel
- **Do NOT use Gabriel's personal connectors**

**Credentials live only in the cloud:** GitHub fine-grained PAT (Contents R/W on `CheloTravel/Proposals` only) and Drive folder ID are stored as **Apps Script Properties** on Gabriel's `CheloTravel Sync` script project. Nothing on Marcelo's Mac.

---

## Three Prompts

These prompts live as project knowledge inside a Claude Chat project called "CheloTravel".

### Prompt 1: Client Intake (`prompts/client-intake.md`)
- **Trigger:** "New client" or pasted call notes / WhatsApp transcript
- **Process:** AI extracts structured fields → shows summary → asks multiple-choice for missing fields (3-4 at a time) → confirms → saves to Notion Clients DB
- **Includes:** Contact info, preferences, documents (passport, license), loyalty programs, dietary restrictions

### Prompt 2: Trip Builder (`prompts/trip-builder.md`)
- **Trigger:** "Plan a trip for..." or "Change hotel to..." or any trip modification
- **Create mode:** Read client → suggest itinerary from Assets DB → save Trip Card
- **Update mode:** Natural language changes → update Trip in Notion → log changes
- **Status transitions:** Ideation → Availability → Pricing → Final → Booked

### Prompt 3: Proposal Generator (`prompts/proposal-generator.md`)
- **Trigger:** "Generate proposal" or "Final proposal"
- **Process:** Read Trip + Client + Assets from Notion → generate stage-aware HTML → push to GitHub → update Notion with live URL
- **Stage-aware rendering:** Draft (ideation) → In Progress (availability) → Complete (pricing/final)
- **Design system:** Playfair Display + Inter, warm linen palette, gold accents, 8-section structure

---

## Notion Databases

### Clients DB
| Property | Type |
|----------|------|
| Name | Title |
| First Name | Text (for reservations — must match passport) |
| Last Name | Text (for reservations — must match passport) |
| Email | Email |
| Phone | Phone |
| WhatsApp | Phone |
| Referral Source | Text |
| Preferred Language | Select (English, Spanish, Portuguese, Other) |
| Home City | Text |
| Travel Frequency | Select (1x/yr, 2-3x/yr, 4+/yr) |
| Group Composition | Text |
| Preferences | Multi-select (Gastronomy, Culture, Beach, Adventure, Shopping, Ski, Cruise) |
| Budget Tier | Select (Standard Luxury, Ultra Luxury, No Limit) |
| Passport | Files & media |
| Passport Expiry | Date |
| Passport Number | Text |
| Nationality | Select |
| Driver's License | Files & media |
| Other Documents | Files & media |
| Loyalty Programs | Text |
| Dietary Restrictions | Text |
| Room Preferences | Text |
| Flight Preferences | Text |
| Notes | Text |
| Trips | Relation → Trips DB |

### Trips DB
| Property | Type |
|----------|------|
| Trip Name | Title |
| Client | Relation → Clients DB |
| Status | Select (Lead, Intake, Ideation, Availability, Pricing, Final, Booked, Traveling, Complete) |
| Destination(s) | Multi-select |
| Trip Type | Select (Family, Honeymoon, Couple, Group, Solo) |
| Start Date | Date |
| End Date | Date |
| Party Size | Number |
| Total Nights | Number |
| Budget Range | Text |
| Proposal Version | Number |
| Proposal URL | URL (current/latest) |
| All Versions | Text ("v1 (Apr 11) Ideation: url | v2 (Apr 13) Availability: url") |
| WETU Link | URL |
| Flight Preferences | Text |
| Experience Preferences | Multi-select |
| Room Preferences | Text |
| Planning Fee | Number |
| Ticketing Fee | Number |
| Assets Used | Relation → Assets DB |
| Itinerary | Text (rich) |
| Notes | Text |
| Call Notes | Text |
| Version History | Text |

### Assets DB
| Property | Type |
|----------|------|
| Name | Title |
| Category | Select (Hotel, Restaurant, Experience) |
| Destination | Select |
| City/Region | Text |
| Brand/Affiliation | Multi-select |
| Virtuoso | Checkbox |
| Price Tier | Select |
| Room Types | Text |
| Cuisine Type | Text |
| Meal Type | Multi-select |
| Duration | Text |
| Booking Method | Select |
| Contact | Text |
| Hero Image URL | URL |
| Amenities | Text |
| Notes | Text |

### Proposals DB
| Property | Type |
|----------|------|
| Proposal Name | Title |
| Client | Relation → Clients DB |
| Trip | Relation → Trips DB |
| Version | Number |
| Stage | Select (Draft, In Progress, Complete) |
| Status | Select (Generated, Saved, Deployed, Sent) |
| Live URL | URL |
| Filename | Text |
| Deploy Date | Date |
| Notes | Text |

---

## Customer Lifecycle

```
ACQUIRE → CAPTURE → IDEATE → AVAILABILITY → PRICING → FINAL → BOOK → TRAVEL → CLOSE
```

**Marcelo's experience — just conversation:**
```
"New client, here are my call notes"      → Client saved in Notion
"Plan Italy trip for the Smiths"          → Trip Card created in Notion
"Change hotel to Four Seasons"            → Trip updated in Notion
"Generate proposal"                       → HTML live at URL, Notion updated
"Move to availability, Aman confirmed"    → Status + hotels updated
"Add pricing: hotels $12K, flights $4K"   → Pricing updated
"Final proposal"                          → Full proposal live, link returned in chat
                                            Marcelo shares link with client (email/WhatsApp/text)
```

---

## Build Phases (Gabriel executes all setup)

### Phase 1: Infrastructure ✅
1. ✅ GitHub repo created: `CheloTravel/Proposals` (private)
2. ✅ Vercel project created: `chelotravel` (Hobby plan, public access)
3. ✅ Vercel connected to GitHub — auto-deploy on push verified
4. ✅ Both reference proposals deployed and live
5. ⬚ Custom domain: `proposals.chelotravel.com` — set up in Vercel Settings → Domains, add DNS CNAME to `cname.vercel-dns.com`
6. ⬚ **Drive → GitHub auto-sync (Apps Script)** — set up the cloud bridge so Marcelo's Mac runs only Claude + Notion. Full instructions in [apps-script/README.md](apps-script/README.md):
   - Create GitHub fine-grained PAT (Contents R/W on `CheloTravel/Proposals`)
   - Create Apps Script project at script.google.com, paste `apps-script/Code.gs`
   - Add 3 Script Properties: `DRIVE_FOLDER_ID`, `GITHUB_TOKEN`, `GITHUB_REPO`
   - Run `syncOnce` once to authorize Drive + UrlFetch scopes
   - Add 5-minute time-driven trigger

### Phase 2: Notion Databases ✅
1. ✅ 3 databases created with all properties, relations, and select options
2. ✅ Assets DB seeded: 5 hotels (Hemingways, Ol Donyo, Mara Plains, Cheval Blanc, Villa Senna) + 3 restaurants (L'Isola, NAO Beach Club, Le Ti St Barth)
3. ✅ Test entries created: 2 clients (Zevallos, Rosen) + 2 trips with full relations (Client ↔ Trip ↔ Assets)

### Phase 3: Prompt Development
1. ✅ `prompts/system-instructions.md` — master project instructions
2. ✅ `prompts/client-intake.md` — natural language → Client Card
3. ✅ `prompts/trip-builder.md` — create/update Trip Cards
4. ✅ `prompts/proposal-generator.md` — Trip Card → stage-aware HTML
5. Test each prompt in Claude Chat

### Phase 4: Claude Chat Project Setup
1. Create Claude Chat project "CheloTravel"
2. Upload all prompt files as project knowledge
3. Add the `virtuoso-image-sourcing` skill to the project (on-demand image recovery; requires the Claude for Chrome browser tool + Marcelo signed in to the Virtuoso portal)
4. Connect MCP integrations: **Notion** + **Google Drive** (Drive MCP must have write access to `Propuestas/`). GitHub MCP is NOT used.
5. Test full end-to-end workflow

### Phase 5: Onboarding Marcelo
1. Walk through the workflow
2. Test with a real client
3. Adjust prompts based on feedback

---

## Phase II: Enhancements (future)

1. **Client Intake Form** — Quick web form Gabriel generates and sends to a new customer. Customer fills in basics (names, ages, nationality, city). Submission writes directly to Notion Clients DB — no back-and-forth needed for basic info.

2. **Early Availability Focus** — When starting trip planning, surface cities to visit, flight availability, and hotel availability very early in the process. Don't defer to later stages — Marcelo needs to know what's possible before building the full itinerary.

3. **Asset Approval Gate** — Claude proposes assets but does NOT auto-add to Assets DB. Marcelo reviews and approves → only then saved. Prevents the DB from filling with unvetted properties.

4. **Gmail MCP** — Connect Gmail to Claude Chat so Marcelo can send proposal links directly to clients from the conversation.

---

## Key Files

### Infrastructure
- `apps-script/Code.gs` — Apps Script source for the Drive → GitHub sync (paste into a script.google.com project)
- `apps-script/README.md` — step-by-step setup
- Apps Script Properties: `DRIVE_FOLDER_ID`, `GITHUB_TOKEN` (fine-grained PAT), `GITHUB_REPO`
- **No local install on Marcelo's Mac. No `.env` file. No watcher process. No GCP project.**

### Prompts (Claude Chat project knowledge)
- `prompts/system-instructions.md` — Master project instructions
- `prompts/client-intake.md` — Client intake prompt
- `prompts/trip-builder.md` — Trip builder prompt
- `prompts/proposal-generator.md` — Proposal generator prompt (includes full design system)

### Skills (Claude Project — invoked on demand by Marcelo)
- `skills/virtuoso-image-sourcing/` — recovery skill for when a proposal renders
  "IMAGE PENDING". Marcelo invokes it in chat (e.g. "source the missing photos
  for the Basque proposal"); it harvests vetted images from his authenticated
  Virtuoso portal via Claude for Chrome, validates each URL is hotlink-safe from
  a clean context (`scripts/validate_image.py`), and writes the survivors to the
  Notion Asset record. **Standalone — not wired into the proposal generator.**

### Reference Proposals
- `proposals/zevallos-africa-seychelles-2026.html` — Multi-destination (safari + beach)
- `proposals/stbarths-angie-rosen-may-2026.html` — Single-destination (villa + dining)
