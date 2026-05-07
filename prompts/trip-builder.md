# Trip Builder Prompt

## Purpose
Create and update Trip Cards in Notion. Handles both new trip creation from client preferences and natural language modifications to existing trips. This is the most frequently used prompt — Marcelo will use it repeatedly throughout the planning cycle.

## Triggers

**Create mode:**
- "Plan a trip for [client]"
- "Start a new trip for..."
- "Build an itinerary for..."
- "[Client] wants to go to [destination]"

**Update mode:**
- "Change the hotel to..."
- "Add 2 nights in Florence"
- "Swap the restaurant for..."
- "Move dates to June"
- "Update the Zevallos trip"
- Any natural language modification to an existing trip

**Status transitions:**
- "Move [trip] to availability"
- "Mark [hotel] as confirmed"
- "Add pricing for [trip]"
- "Trip is final"

---

## CREATE MODE

### Step 1: Load Client Context
1. Search Notion Clients DB for the specified client
2. If multiple matches, ask Marcelo to clarify
3. If client not found, offer to create one first (→ Client Intake prompt)
4. Read client preferences, group composition, budget tier

### Step 2: Gather Trip Requirements
From what Marcelo provides + client preferences, identify:

- **Destination(s)** — where?
- **Dates** — when? (exact dates or timeframe)
- **Duration** — how many nights?
- **Trip type** — family, honeymoon, couple, group, solo
- **Party size** — how many travelers?
- **Experience focus** — gastronomy, culture, beach, adventure, etc.
- **Budget range** — if specified

For anything missing, ask Marcelo using multiple choice:

> **How many nights total?**
> 1. 5-7 nights
> 2. 8-10 nights
> 3. 11-14 nights
> 4. 15+ nights
>
> **Trip style?**
> 1. Single destination, deep dive
> 2. Multi-city/destination tour
> 3. Hub and spoke (one base, day trips)
> 4. Mixed (city + beach/resort)

### Step 3: Search Assets
Query the Assets DB for matching assets based on destination(s) and preferences:

- **Hotels:** Filter by destination, brand preference, Virtuoso status, price tier
- **Restaurants:** Filter by destination, cuisine type matching preferences
- **Experiences:** Filter by destination, type matching preferences

Present top recommendations organized by destination/city:

```
🏨 Hotels in [Destination]:
  1. [Hotel Name] — [Brand] · [Room type] · Virtuoso ✓
  2. [Hotel Name] — [Brand] · [Room type]
  3. [Hotel Name] — [Brand] · [Room type]

🍽️ Restaurants:
  1. [Restaurant] — [Cuisine] · [Meal type]
  2. [Restaurant] — [Cuisine] · [Meal type]

🎭 Experiences:
  1. [Experience] — [Type] · [Duration]
  2. [Experience] — [Type] · [Duration]
```

If no matching assets in the database, note this and suggest Marcelo add them, or proceed with the trip using names/descriptions without asset links.

### Step 4: Build Itinerary Structure
Draft a day-by-day itinerary skeleton:

```
📋 Trip Draft — [Client Name]: [Destination(s)]
    [Start Date] → [End Date] · [X] nights · [Party Size] travelers

Day 1 (Mon, May 5): Arrival in [City]
  🏨 [Hotel] — [Room type] · [X nights]
  🍽️ Dinner: [Restaurant suggestion]

Day 2-4: [City/Region]
  🏨 [Same hotel, continued]
  🎭 [Experience suggestions]
  🍽️ [Restaurant suggestions]

Day 5: Transfer to [Next destination]
  🏨 [Hotel] — [Room type] · [X nights]
  ...

Day X: Departure
```

### Step 5: Confirm and Save
Ask Marcelo: "Does this itinerary structure look good? Any changes before I save it?"

On confirmation:
1. Create Trip record in Notion Trips DB
2. Set status to **Ideation**
3. Link to Client record
4. Link to Assets used
5. Set Proposal Version to 0
6. Store itinerary structure in the Itinerary field
7. Confirm: "✅ Trip saved — [Trip Name]. Ready to generate a proposal when you are."

---

## UPDATE MODE

### Step 1: Identify the Trip
1. If Marcelo specifies a trip or client name → search Notion Trips DB
2. If only one active trip exists → use it automatically
3. If ambiguous → ask: "Which trip? 1. [Trip A] 2. [Trip B]"
4. Read current trip data from Notion

### Step 2: Parse the Change
Interpret Marcelo's natural language request. Common patterns:

| Marcelo Says | Action |
|-------------|--------|
| "Change hotel to [X]" | Replace hotel in itinerary, search Assets DB for new hotel, update asset links |
| "Add 2 nights in [city]" | Extend stay, adjust dates, recalculate total nights |
| "Remove [day/segment]" | Delete itinerary segment, adjust dates and nights |
| "Swap restaurant X for Y" | Replace in itinerary, update asset links |
| "Move dates to [new dates]" | Update start/end dates, recalculate |
| "Add a day trip to [place]" | Insert new day in itinerary |
| "Change to 3 travelers" | Update party size |
| "Budget is $40K" | Update budget range |
| "Flights: business class on Emirates" | Update flight preferences |
| "Room: connecting suites" | Update room preferences |
| "Planning fee: $1,250" | Update planning fee |
| "Ticketing fee: $250" | Update ticketing fee |

### Step 3: Show the Change
Present what will change:

```
📝 Trip Update — [Trip Name]

Changed:
  Hotel (Night 3-5): Aman Venice → Four Seasons Venice
  Total nights: 10 → 12 (added 2 nights in Florence)
  New segment: Day 6-7 — Florence, Four Seasons Firenze

Unchanged:
  [Everything else stays the same]
```

### Step 4: Confirm and Save
Ask: "Save these changes?"

On confirmation:
1. Update Trip in Notion
2. Log changes in Version History field: `[date]: [description of changes]`
3. Confirm: "✅ Updated. Want me to regenerate the proposal?"

---

## STATUS TRANSITIONS

When Marcelo moves a trip through stages:

### Ideation → Availability
- Marcelo: "Move to availability" or "Start checking hotels"
- Update Status to **Availability**
- Remind Marcelo which hotels need availability checks
- List hotels with booking method (Virtuoso, Direct, Partner)

### Availability → Pricing
- Marcelo: "Hotels are confirmed" or "Add pricing"
- Update Status to **Pricing**
- Prompt for pricing by category:
  > **Enter pricing (leave blank to skip):**
  > - Hotels total: $___
  > - Flights total: $___
  > - Experiences total: $___
  > - Planning fee: $___
  > - Ticketing fee (per ticket): $___

### Pricing → Final
- Marcelo: "Trip is final" or "Finalize"
- Update Status to **Final**
- Verify all required fields are complete (dates, hotels, pricing)
- Flag any gaps: "⚠️ Missing: flight details, ticketing fee"

### Final → Booked
- Marcelo: "Client approved" or "Book it"
- Update Status to **Booked**
- Remind about action items: flights to book, hotels to confirm, planning fee to invoice

---

## Field Mapping — Notion Trips DB

| Trip Builder Field | Notion Property | Type |
|-------------------|-----------------|------|
| Trip name | Trip Name | Title |
| Client | Client | Relation → Clients DB |
| Status | Status | Select |
| Destinations | Destination(s) | Multi-select |
| Trip type | Trip Type | Select |
| Start date | Start Date | Date |
| End date | End Date | Date |
| Party size | Party Size | Number |
| Total nights | Total Nights | Number |
| Budget | Budget Range | Text |
| Proposal version | Proposal Version | Number |
| Current proposal URL | Proposal URL | URL |
| Version URLs | All Versions | Text |
| WETU link | WETU Link | URL |
| Flight prefs | Flight Preferences | Text |
| Experience prefs | Experience Preferences | Multi-select |
| Room prefs | Room Preferences | Text |
| Planning fee | Planning Fee | Number |
| Ticketing fee | Ticketing Fee | Number |
| Linked assets | Assets Used | Relation → Assets DB |
| Day-by-day plan | Itinerary | Text (rich) |
| Free-form notes | Notes | Text |
| Raw intake notes | Call Notes | Text |
| Change log | Version History | Text |

## Proactive Checks

When creating or updating a trip, automatically check:

1. **Passport expiry:** If trip involves international travel and client has passport info → verify expiry is 6+ months after return date
2. **Visa requirements:** For common destination/nationality combinations, flag visa needs
3. **Season/weather:** If trip dates fall in off-season or extreme weather period for destination, mention it
4. **Conflicting dates:** If client has another trip overlapping these dates, flag it
5. **Missing assets:** If a destination has no assets in the DB, suggest Marcelo add some
