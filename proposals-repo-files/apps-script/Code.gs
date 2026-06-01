/**
 * CheloTravel — Drive → GitHub proposal sync (Apps Script)
 *
 * Root problem this solves
 * ------------------------
 * Proposals are authored by Claude Chat straight into the Google Drive
 * `Propuestas/` folder, then pushed to GitHub (which Vercel auto-deploys).
 * That push can be driven by the GitHub Actions `schedule:` cron in
 * ../.github/workflows/sync-proposals.yml. GitHub documents scheduled
 * workflows as *best-effort*: they are delayed under load (worst at the top of
 * the hour) and queued runs can be dropped entirely — there is no SLA. The
 * result is deploys that land "inconsistently and randomly," often many
 * minutes late or skipped.
 *
 * This script is a more reliable, drop-in alternative scheduler: an Apps Script
 * time-driven trigger fires on a dependable schedule. It runs as Gabriel's
 * Google account (no GCP service account or key needed): it reads the Drive
 * folder directly and PUTs new/changed files to GitHub via the Contents API.
 * It is idempotent (it skips unchanged files), so it can run alongside or in
 * place of the cron.
 *
 * Setup: see README.md in this folder.
 *
 * Script Properties (Project Settings → Script Properties):
 *   DRIVE_FOLDER_ID   ID of the Propuestas folder in Drive
 *   GITHUB_TOKEN      fine-grained PAT, Contents R/W on the proposals repo
 *   GITHUB_REPO       "owner/repo", e.g. "CheloTravel/Proposals"
 *   GITHUB_BRANCH     optional, defaults to "main"
 *
 * Requires the advanced "Drive API" service enabled (Services → Drive API).
 */

const PROPOSALS_PATH = 'proposals';   // path prefix inside the repo
const TRIGGER_MINUTES = 5;            // cadence of the time-driven trigger
const STATE_KEY = 'SYNCED_MD5';       // Script Property holding a name -> md5 map

// Safety switch for a production system with no staging environment. While true,
// syncOnce() only LOGS what it would push and writes nothing to GitHub (and does
// not persist sync state). Run it once, read the execution log, confirm it
// matches reality, then set this to false to go live.
const DRY_RUN = true;

/**
 * One sync pass. This is both the time-driven trigger handler and the function
 * to run manually the first time (to authorize the Drive + UrlFetch scopes).
 *
 * Stateful-but-self-healing: a file is skipped only when its Drive
 * `md5Checksum` matches the checksum we recorded the last time we pushed it.
 * New or changed files are downloaded and PUT to GitHub. Nothing is deleted.
 * Run `resetState()` to force a full re-check on the next pass.
 */
function syncOnce() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DRIVE_FOLDER_ID');
  const token = props.getProperty('GITHUB_TOKEN');
  const repoFull = props.getProperty('GITHUB_REPO');
  const branch = props.getProperty('GITHUB_BRANCH') || 'main';

  if (!folderId || !token || !repoFull) {
    throw new Error('Missing Script Properties: need DRIVE_FOLDER_ID, GITHUB_TOKEN, GITHUB_REPO.');
  }
  const slash = repoFull.indexOf('/');
  if (slash < 1) {
    throw new Error('GITHUB_REPO must be "owner/repo", e.g. "CheloTravel/Proposals".');
  }
  const owner = repoFull.slice(0, slash);
  const repo = repoFull.slice(slash + 1);

  // The trigger fires every few minutes; never let two passes overlap.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) {
    console.log('Previous sync still running; skipping this pass.');
    return;
  }

  try {
    const state = JSON.parse(props.getProperty(STATE_KEY) || '{}');
    const files = listHtmlInFolder(folderId);
    let added = 0, updated = 0, skipped = 0;

    for (const f of files) {
      const name = f.name;
      // Mirror the guard in sync_drive.py: never write paths with "/" or dotfiles.
      if (name.indexOf('/') !== -1 || name.charAt(0) === '.') {
        console.log('ignored (unsafe name): ' + name);
        continue;
      }

      // Fast path: Drive's md5Checksum unchanged since we last pushed it.
      if (f.md5Checksum && state[name] === f.md5Checksum) {
        skipped++;
        continue;
      }

      const path = PROPOSALS_PATH + '/' + name;
      const sha = getGitHubSha(owner, repo, path, branch, token); // null if new (read-only)

      if (DRY_RUN) {
        // Log the intended action; touch nothing and don't persist state.
        if (sha) { updated++; console.log('[DRY RUN] would update: ' + name); }
        else { added++; console.log('[DRY RUN] would add:    ' + name); }
        continue;
      }

      const bytes = DriveApp.getFileById(f.id).getBlob().getBytes();
      putGitHubFile(owner, repo, path, branch, token, bytes, sha, name);

      if (sha) { updated++; console.log('updated: ' + name); }
      else { added++; console.log('added:   ' + name); }
      if (f.md5Checksum) state[name] = f.md5Checksum;
    }

    if (!DRY_RUN) props.setProperty(STATE_KEY, JSON.stringify(state));
    console.log((DRY_RUN ? '[DRY RUN] ' : '') +
                'Summary: ' + added + ' added, ' + updated + ' updated, ' +
                skipped + ' skipped (' + files.length + ' total in Drive)');
  } finally {
    lock.releaseLock();
  }
}

/** Create (or replace) the time-driven trigger. Run once after authorizing. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'syncOnce'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncOnce').timeBased().everyMinutes(TRIGGER_MINUTES).create();
  console.log('Installed trigger: syncOnce every ' + TRIGGER_MINUTES + ' minutes.');
}

/** Clear the md5 cache to force a full re-check on the next pass (self-heal). */
function resetState() {
  PropertiesService.getScriptProperties().deleteProperty(STATE_KEY);
  console.log('Sync state cleared; next run will re-check every file.');
}

/** List non-trashed text/html files in the folder (paginated), with md5. */
function listHtmlInFolder(folderId) {
  const out = [];
  let pageToken = null;
  const q = "'" + folderId + "' in parents and trashed = false and mimeType = 'text/html'";
  do {
    const resp = Drive.Files.list({
      q: q,
      fields: 'nextPageToken, files(id, name, md5Checksum)',
      pageSize: 1000,
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    (resp.files || []).forEach(function (f) { out.push(f); });
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return out;
}

/** Current blob SHA of a repo file, or null if it does not exist yet. */
function getGitHubSha(owner, repo, path, branch, token) {
  const url = 'https://api.github.com/repos/' + owner + '/' + repo +
              '/contents/' + encodeURI(path) + '?ref=' + encodeURIComponent(branch);
  const r = ghFetch('get', url, token, null);
  if (r.code === 200) return JSON.parse(r.body).sha;
  if (r.code === 404) return null;
  throw new Error('GitHub GET ' + path + ' failed: ' + r.code + ' ' + r.body);
}

/** Create or update a file via the Contents API. */
function putGitHubFile(owner, repo, path, branch, token, bytes, sha, name) {
  const url = 'https://api.github.com/repos/' + owner + '/' + repo +
              '/contents/' + encodeURI(path);
  const payload = {
    message: 'sync from Drive: ' + name,
    content: Utilities.base64Encode(bytes),
    branch: branch,
  };
  if (sha) payload.sha = sha;
  const r = ghFetch('put', url, token, payload);
  if (r.code !== 200 && r.code !== 201) {
    throw new Error('GitHub PUT ' + path + ' failed: ' + r.code + ' ' + r.body);
  }
}

/** Thin UrlFetch wrapper for the GitHub REST API. */
function ghFetch(method, url, token, payload) {
  const params = {
    method: method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'chelotravel-sync',
    },
    muteHttpExceptions: true,
  };
  if (payload) {
    params.contentType = 'application/json';
    params.payload = JSON.stringify(payload);
  }
  const resp = UrlFetchApp.fetch(url, params);
  return { code: resp.getResponseCode(), body: resp.getContentText() };
}
