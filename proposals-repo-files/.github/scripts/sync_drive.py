"""Sync HTML proposals from a Drive folder into proposals/ in this repo.

Stateless: compares Drive file md5Checksum against the MD5 of the file already
checked out at proposals/<name>. Adds new files, overwrites changed ones,
leaves unchanged files alone. Does not delete anything.

Reads:
  GCP_SA_KEY      - service account JSON (full content, not a path)
  DRIVE_FOLDER_ID - ID of the Propuestas folder in Drive
"""

import hashlib
import io
import json
import os
import sys
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
PROPOSALS_DIR = Path("proposals")


def drive_client():
    raw = os.environ["GCP_SA_KEY"]
    info = json.loads(raw)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def list_html_in_folder(svc, folder_id):
    files = []
    page_token = None
    q = (
        f"'{folder_id}' in parents and trashed = false "
        f"and mimeType = 'text/html'"
    )
    while True:
        resp = svc.files().list(
            q=q,
            fields="nextPageToken, files(id, name, md5Checksum)",
            pageSize=1000,
            pageToken=page_token,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


def md5_of(path: Path) -> str | None:
    if not path.exists():
        return None
    return hashlib.md5(path.read_bytes()).hexdigest()


def download(svc, file_id: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = svc.files().get_media(fileId=file_id, supportsAllDrives=True)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, req)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    dest.write_bytes(buf.getvalue())


def main() -> int:
    folder_id = os.environ["DRIVE_FOLDER_ID"]
    svc = drive_client()

    drive_files = list_html_in_folder(svc, folder_id)
    added = updated = skipped = 0

    for f in drive_files:
        name = f["name"]
        if "/" in name or name.startswith("."):
            print(f"  ignored (unsafe name): {name}")
            continue
        local = PROPOSALS_DIR / name
        local_md5 = md5_of(local)
        drive_md5 = f.get("md5Checksum")

        if local_md5 == drive_md5 and drive_md5 is not None:
            skipped += 1
            continue

        download(svc, f["id"], local)
        if local_md5 is None:
            added += 1
            print(f"  added:   {name}")
        else:
            updated += 1
            print(f"  updated: {name}")

    print(f"\nSummary: {added} added, {updated} updated, {skipped} skipped "
          f"({len(drive_files)} total in Drive)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
