# Drive → GitHub sync (Apps Script)

A reliable deploy bridge for CheloTravel proposals. It is a drop-in alternative
to the GitHub Actions cron in [`../.github/workflows/sync-proposals.yml`](../.github/workflows/sync-proposals.yml):
same job, dependable scheduling. It is idempotent (it skips unchanged files), so
it can run alongside or in place of the cron.

## The problem this solves

Proposals are written by Claude Chat directly into the Google Drive `Propuestas/`
folder. From there they need to reach the GitHub repo so Vercel can auto-deploy
them.

Today that push runs on a GitHub Actions `schedule:` cron (`*/3 * * * *`).
GitHub explicitly documents scheduled workflows as **best-effort**: they are
delayed under load (worst at the top of every hour) and queued runs can be
**dropped entirely** — there is no timing SLA. In practice deploys land
"inconsistently and randomly," often many minutes late or skipped.

An Apps Script **time-driven trigger** fires on a dependable schedule, so the
randomness goes away. It also runs as Gabriel's Google account, so there is no
GCP service account or key to manage — it reads Drive directly and writes to
GitHub via the Contents API.

```
Claude Chat ──► Drive: Propuestas/ ──► [Apps Script trigger, every 5 min] ──► GitHub ──► Vercel
```

## One-time setup

1. **GitHub token.** Create a fine-grained PAT with **Contents: Read and write**
   scoped to the `CheloTravel/Proposals` repo only.

2. **Apps Script project.** Go to [script.google.com](https://script.google.com)
   (signed in as the account that can see the `Propuestas/` folder — Gabriel),
   create a new project named `CheloTravel Sync`, and paste in `Code.gs`.

3. **Enable the Drive API.** In the editor sidebar: **Services → +** → add
   **Drive API** (identifier `Drive`).

4. **Script Properties.** Project Settings (gear) → **Script Properties** → add:

   | Property          | Value                                  |
   | ----------------- | -------------------------------------- |
   | `DRIVE_FOLDER_ID` | ID of the `Propuestas/` folder         |
   | `GITHUB_TOKEN`    | the fine-grained PAT from step 1       |
   | `GITHUB_REPO`     | `CheloTravel/Proposals`                |
   | `GITHUB_BRANCH`   | *(optional)* `main` if omitted         |

5. **Dry run (authorize + verify).** `Code.gs` ships with `DRY_RUN = true`.
   Select `syncOnce` and click **Run** once. Approve the Drive + external-request
   permission prompts, then read the execution log: every line is prefixed
   `[DRY RUN] would add/update …` and **nothing is written to GitHub**. Confirm
   the list matches what you expect in `Propuestas/`.

6. **Go live.** Set `DRY_RUN = false` at the top of `Code.gs`, run `syncOnce`
   once more, and confirm a known proposal reaches the repo and Vercel publishes
   it. The log now shows real `added/updated/skipped` counts.

7. **Install the trigger.** Select `installTrigger` and click **Run**. This
   creates a time-driven trigger that calls `syncOnce` every 5 minutes. (Adjust
   `TRIGGER_MINUTES` at the top of `Code.gs` — Apps Script supports 1, 5, 10, 15,
   or 30 — then re-run `installTrigger` to change the cadence.)

8. **The existing cron.** `.github/workflows/sync-proposals.yml` is unchanged and
   its cron keeps running. Because this script is idempotent, the two can coexist
   safely; once you trust the Apps Script trigger you may pause the cron (delete
   the `schedule:` block, keeping `workflow_dispatch` as a manual fallback) to
   avoid redundant double-pushes. That change is intentionally **not** part of
   this PR.

## How it works

- Lists `text/html` files in the Drive folder (paginated, shared-drive aware).
- Skips a file when its Drive `md5Checksum` matches the checksum recorded the
  last time it was pushed (stored in the `SYNCED_MD5` Script Property).
- For new or changed files: fetches the current GitHub blob SHA (if any),
  downloads the Drive bytes, and PUTs them to `proposals/<name>` via the
  Contents API.
- A script lock prevents overlapping runs. Nothing is ever deleted. Files with
  unsafe names (`/` or leading `.`) are ignored.

## Troubleshooting

- **A file won't re-sync / state looks stale:** run `resetState()` once to clear
  the md5 cache; the next pass re-checks every file.
- **`GitHub PUT … failed: 403/404`:** the PAT lacks Contents write, or
  `GITHUB_REPO` / `GITHUB_BRANCH` is wrong.
- **`DriveApp` can't find the file:** the folder must be shared with the account
  that owns the Apps Script project.

## Alternative: Google Cloud Scheduler

If you'd rather not run this in Apps Script, the same outcome is achievable by
running the existing `../.github/scripts/sync_drive.py` on **Google Cloud Run**
triggered by **Cloud Scheduler** (minute-accurate, with a real SLA). That path
keeps the GCP service-account read access already described in `PLAN.md`. Apps
Script is the lighter-weight option and is the one wired up here.
