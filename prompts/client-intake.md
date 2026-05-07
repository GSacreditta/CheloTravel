# Client Intake Prompt

## Purpose
Create or update Client Cards in Notion from natural language input. This prompt handles client information ONLY — trip details are handled by the Trip Builder prompt. Most of the time, Marcelo will give client and trip info mixed together in one message. Separate them: handle client info here, then hand off trip info to Trip Builder.

## Trigger
Marcelo says anything like:
- "New client..."
- "Just had a call with..."
- "Here are my notes from..."
- Pastes a WhatsApp conversation or call transcript
- Mentions a client name in any context

## Critical Rule: Always Check Existing Clients First

**Before creating any new client, ALWAYS search Notion Clients DB first.**

1. Search by the name mentioned (first name, last name, or both)
2. If **exact match found** → use existing client. Show Marcelo: "Found [Full Name] in the system. Updating their info."
3. If **multiple clients with the same first name** → ask Marcelo to clarify by showing last names:
   > "I found multiple clients named [First Name]:
   > 1. [First Name] [Last Name A]
   > 2. [First Name] [Last Name B]
   > 3. This is a new client
   > Which one?"
4. If **no match found** → proceed to create new client
5. If only a first name is given and no matches → ask: "What's [First Name]'s last name?"

Many clients are **returning customers** — their info may already be complete or mostly complete. Don't re-ask for info that's already in the system.

---

## Process

### Step 1: Extract Client Fields from Input
Parse whatever Marcelo provides and separate:
- **Client info** → handle here
- **Trip info** (destinations, dates, trip type, itinerary details) → set aside for Trip Builder

Extract as many client fields as possible:

**Contact Information:**
- Full name (first + last)
- **First Name** (extracted separately — critical for reservations)
- **Last Name** (extracted separately — critical for reservations)
- Email
- Phone number
- WhatsApp number

**Profile:**
- Referral source (who referred them)
- Preferred language (English, Spanish, Portuguese, etc.)
- Home city / location
- Travel frequency
- Group/family composition
- Family leader (primary contact/decision maker)

**Preferences:**
- Experience types: Gastronomy, Culture, Beach, Adventure, Shopping, Ski, Cruise
- Budget tier
- Dietary restrictions or preferences
- Room preferences (suite, connecting, pool villa, etc.)
- Flight preferences (airline, class, routing)

**Documents (if mentioned):**
- Passport info — number, expiry, nationality, OR image files of passport/visa/documents (either is sufficient)
- Loyalty program numbers

### Passport Validation Rules

When passport information is available (number, expiry, name on passport, or passport image file):

1. **Name validation:** Cross-check First Name and Last Name against passport. If the name on the passport differs from how Marcelo refers to the client (nicknames, middle names, spelling), flag it:
   > "⚠️ The name on file is 'Mike Zevallos' but passports typically use legal names. Is his passport name 'Michael Zevallos' or something different? This matters for flight reservations."

2. **Expiry check:** If passport expiry is less than 6 months after any planned trip return date, flag immediately:
   > "⚠️ [Client Name]'s passport expires [date] — that's less than 6 months after the trip return. Many countries require 6+ months validity. They may need to renew before traveling."

3. **Passport image as fallback:** If Marcelo uploads a passport image/scan but doesn't provide the number or expiry separately, note that the image is on file and prompt:
   > "Passport scan is saved. Want me to note the passport number and expiry date from it, or is the scan enough for now?"

4. **First Name / Last Name from passport:** If passport info is available but First Name / Last Name fields are empty, extract them from the passport data. Passport name is the authoritative source for reservation names.

### Step 2: Present Summary
For a **new client**, show what was extracted:

```
📋 New Client — [Client Name]

Contact:
  Name: [extracted]
  Phone: [extracted or ❌ needed]
  Email: [extracted or —]

Profile:
  Referred by: [extracted or ❌ needed]
  Language: [extracted or —]
  Home city: [extracted or —]

Preferences:
  [list what was found, or "To be filled in"]
```

For an **existing client**, show only what's new or changed:

```
📋 Updating — [Client Name]

Adding/Updating:
  [only the fields that are new or different]

Already on file:
  [summary of what's already complete]
```

### Step 3: Ask for Critical Missing Fields Only

Not all fields are critical. Only ask about these if missing:

**Critical — Contact (must have):**
- Full name (first + last) — always required
- **First Name** and **Last Name** stored separately — always required (auto-extracted from full name)
- Phone OR WhatsApp — at least one is required

**Critical — Profile:**
- Referral source — who referred them
- Preferred language
- Home city

**Critical — Preferences:**
- Experience type
- Budget tier
- Dietary restrictions / preferences
- Room preference
- Flight preference

**NOT critical (don't ask, fill in later as info comes):**
- Email (nice to have, not blocking)
- Travel frequency
- Group composition (often becomes clear with the trip)
- Loyalty programs
- Documents (passport, license — collected closer to travel)

### Multiple-Choice Format Rules

When asking for missing critical fields:
- Ask at most **3-4 questions** at a time
- **Every question must include:**
  - The relevant options
  - A "Something specific" / "Other" option for unique details
  - An "N/A" or "Doesn't apply" option (except for Contact info — name and phone are mandatory)
- Group related fields together

**Example — Profile (if missing):**

> **Who referred [Client Name]?**
> 1. [Name if mentioned in context]
> 2. Previous client referral
> 3. Other — tell me who
> 4. Unknown / didn't ask yet
>
> **Preferred language?**
> 1. English
> 2. Spanish
> 3. Portuguese
> 4. Other — which?
>
> **Where are they based?**
> 1. Miami / South Florida
> 2. New York
> 3. Other US city — which?
> 4. Latin America — which city?

**Example — Preferences (if missing):**

> **What type of experiences?** (pick all that apply)
> 1. Gastronomy / Fine Dining
> 2. Culture / Museums / History
> 3. Beach / Relaxation
> 4. Adventure / Safari / Active
> 5. Something specific — tell me
> 6. Varies by trip / no fixed preference
>
> **Budget tier?**
> 1. Standard Luxury ($10K-30K per trip)
> 2. Ultra Luxury ($30K-80K per trip)
> 3. No Limit
> 4. Not discussed yet
>
> **Dietary restrictions?**
> 1. None
> 2. Vegetarian / Vegan
> 3. Kosher / Halal
> 4. Allergies — which?
> 5. Other — tell me
> 6. N/A / doesn't apply

### Step 4: Save to Notion
1. **New client:** Create record in Clients DB with all extracted + confirmed fields
2. **Existing client:** Update only the fields that are new or changed
3. Confirm: "✅ [Client Name] saved."

### Step 5: Hand Off to Trip Builder
If trip details were mentioned in the same message (destinations, dates, trip type — which is almost always the case):

"Now let's set up the trip. [Summarize trip details extracted from the conversation]."

→ Automatically transition to Trip Builder prompt with the client linked and trip details carried over. Don't ask Marcelo "do you want to create a trip?" — just do it, since he clearly mentioned one.

---

## Field Mapping — Notion Clients DB

| Extracted Field | Notion Property | Type |
|----------------|-----------------|------|
| Full name | Name | Title |
| First name | First Name | Text |
| Last name | Last Name | Text |
| Email | Email | Email |
| Phone | Phone | Phone |
| WhatsApp | WhatsApp | Phone |
| Referral source | Referral Source | Text |
| Preferred language | Preferred Language | Select |
| Home city | Home City | Text |
| Travel frequency | Travel Frequency | Select |
| Group composition | Group Composition | Text |
| Experience preferences | Preferences | Multi-select |
| Budget tier | Budget Tier | Select |
| Passport scan/photo | Passport | Files & media |
| Passport number | Passport Number | Text |
| Passport expiry | Passport Expiry | Date |
| Nationality | Nationality | Select |
| Driver's license | Driver's License | Files & media |
| Other documents | Other Documents | Files & media |
| Loyalty programs | Loyalty Programs | Text |
| Dietary restrictions | Dietary Restrictions | Text |
| Room preferences | Room Preferences | Text |
| Flight preferences | Flight Preferences | Text |
| Free-form notes | Notes | Text |

---

## Examples

**Example 1 — Mixed client + trip info (most common scenario):**
Marcelo: "Just got off a call with Michael Zevallos, z@gigglefinance.com. Referred by David. He and his wife want to do Africa safari plus Seychelles beach in May 2026. Budget isn't an issue, he's a foodie and loves adventure."

→ Claude searches Notion: no "Michael Zevallos" found → new client
→ Extracts client info: name, email, referral (David), preferences (gastronomy + adventure), budget (No Limit)
→ Sets aside trip info: Africa + Seychelles, May 2026, couple, safari + beach
→ Shows client summary
→ Missing critical: phone/WhatsApp, language, home city
→ Asks 3 questions with multiple choice (including "Other" and "N/A" options)
→ Saves client
→ Automatically transitions to Trip Builder with trip details

**Example 2 — Returning client, new trip:**
Marcelo: "Angie wants to do St. Barths in May."

→ Claude searches Notion: finds "Angie Rosen" → existing client with complete profile
→ "Found Angie Rosen in the system. Her profile is up to date."
→ No client questions needed
→ Goes straight to Trip Builder: "Let me set up a St. Barths trip for Angie in May."

**Example 3 — Ambiguous first name:**
Marcelo: "Michael called, he wants to plan something for the summer."

→ Claude searches Notion: finds "Michael Zevallos" and "Michael Chen"
→ "I found two Michaels:
   1. Michael Zevallos
   2. Michael Chen
   3. This is a new Michael
   Which one?"

**Example 4 — Very sparse info:**
Marcelo: "New client named Sofia, referred by the Garcias."

→ Claude searches Notion: no "Sofia" found → new client
→ Extracts: first name (Sofia), referral (the Garcias)
→ Missing critical: last name, phone/WhatsApp
→ "What's Sofia's last name? And do you have her phone or WhatsApp?"
→ Gets minimum info → saves client
→ No trip details mentioned → "Got it, Sofia is saved. Let me know when you're ready to start planning a trip for her."
