# Virtuoso Image Sourcing — Install & Setup

On-demand recovery skill: when a generated proposal renders **"IMAGE PENDING"**
(typically chain hotels whose official sites block the automated crawl with
403s), Marcelo invokes this skill in chat to pull vetted, licensed photos from
the **Virtuoso advisor portal**, validate they're hotlink-safe, and write them
onto the Notion Asset records. See `SKILL.md` for the full workflow.

## Prerequisites

- **Claude for Chrome** browser tool enabled, with Marcelo signed in to the
  Virtuoso advisor portal in an open tab (the skill reads the portal as Marcelo).
- **Notion MCP** connected with write access to the Assets DB.
- A session with **real outbound network** for validation. The validator must
  reach the candidate URLs anonymously; sandboxes without egress will 403
  everything and give false `protected` verdicts. Claude.ai's code-execution
  environment is fine.

## Install into the CheloTravel Claude Project (Gabriel)

1. Open the **CheloTravel** Claude Project.
2. Add the skill: upload/sync the `skills/virtuoso-image-sourcing/` folder
   (both `SKILL.md` and `scripts/validate_image.py`) as a project skill.
3. Enable the **Claude for Chrome** browser tool for the project.
4. Confirm **Notion MCP** is connected (write access to Assets DB).
5. Sanity check: in chat, ask *"source the missing photos for <a test
   property> from Virtuoso"* and confirm the skill is invoked.

## How Marcelo uses it

1. A proposal comes back with `IMAGE PENDING`. The generator already lists the
   missing properties in its "⚠ Images to source" TODO.
2. Marcelo: *"Source the missing photos for the Basque proposal from Virtuoso."*
3. The skill finds candidates in the portal, validates them, shows the safe
   shortlist for approval, and writes the approved URLs to Notion.
4. Marcelo: *"Regenerate."* → new version (e.g. v3) with real photos.

## Validating manually (optional)

Run the validator anywhere with network access:

```bash
python scripts/validate_image.py "https://…/photo.jpg" "https://…/clip.mp4"
# verdicts: safe | video | protected | broken
```

Or simply open a candidate URL in a **private/incognito** window (not logged in
to Virtuoso): if the image renders, it's hotlink-safe. Virtuoso's dotCMS CDN
(`virtuoso-prod.dotcms.cloud/dA/…`) is known hotlink-safe.

## Notes

- Never store a Notion-attachment URL as the live image `src` — those URLs are
  signed and expire (~1h). Use a validated direct URL (or rehosted bytes).
- Respect Virtuoso's asset-usage terms (advisor-built client materials). If
  unsure whether public web posting is covered, flag it to Marcelo.
