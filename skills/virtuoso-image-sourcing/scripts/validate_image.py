#!/usr/bin/env python3
"""Anonymous hotlink-safety validator for candidate proposal image URLs.

This MUST run in a clean context (the code-execution sandbox), NOT inside
Marcelo's authenticated Virtuoso browser session. With no cookies and a
cross-site Referer it mimics exactly how the public, Vercel-hosted proposal
will request the image. A URL is only "safe" to embed if it loads HERE.

Usage:
    python validate_image.py URL [URL ...]
    echo '["https://a.jpg","https://b.webp"]' | python validate_image.py -

Output: JSON array of
    {url, verdict, status, content_type, bytes, reason}
  verdict is one of:
    "safe"      -> loads anonymously as a real image; OK to write to Notion
    "protected" -> blocked for third parties (403/401 or bounced to HTML)
    "broken"    -> dead link / not an image / too small to be a real photo
"""
import json
import sys
import urllib.request
import urllib.error

# Pretend to be the public proposal host requesting the image cross-origin.
PROPOSAL_ORIGIN = "https://chelotravel.com"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
MIN_BYTES = 5000  # reject 1px trackers and "image unavailable" stubs

IMAGE_TYPES = ("image/jpeg", "image/jpg", "image/png", "image/webp",
               "image/avif", "image/gif")
MAGIC = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"GIF87a", b"GIF89a")


def _looks_like_image(head: bytes) -> bool:
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return True
    return any(head.startswith(m) for m in MAGIC)


def check(url: str) -> dict:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": PROPOSAL_ORIGIN + "/",   # cross-site referer == embedded use
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        # deliberately NO Cookie header
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = getattr(resp, "status", resp.getcode())
            ctype = resp.headers.get("Content-Type", "").split(";")[0].strip().lower()
            clen = resp.headers.get("Content-Length")
            head = resp.read(65536)
    except urllib.error.HTTPError as e:
        verdict = "protected" if e.code in (401, 403) else "broken"
        return {"url": url, "verdict": verdict, "status": e.code,
                "content_type": None, "bytes": 0,
                "reason": f"HTTP {e.code} {e.reason}"}
    except Exception as e:  # noqa: BLE001 - report any transport failure verbatim
        return {"url": url, "verdict": "broken", "status": None,
                "content_type": None, "bytes": 0,
                "reason": f"{type(e).__name__}: {e}"}

    size = int(clen) if (clen and clen.isdigit()) else len(head)
    sniff = head[:64].lstrip().lower()

    # Bounced to a login/homepage instead of serving the file.
    if ctype == "text/html" or sniff.startswith(b"<!doctype") or sniff.startswith(b"<html"):
        return {"url": url, "verdict": "protected", "status": status,
                "content_type": ctype, "bytes": size,
                "reason": "Returned HTML (redirect to login/homepage), not an image"}

    is_image = _looks_like_image(head) or any(
        ctype.startswith(t) for t in IMAGE_TYPES) if ctype else _looks_like_image(head)
    if not is_image:
        return {"url": url, "verdict": "broken", "status": status,
                "content_type": ctype, "bytes": size,
                "reason": f"Not recognizable image bytes (content-type: {ctype or 'none'})"}

    if size and size < MIN_BYTES:
        return {"url": url, "verdict": "broken", "status": status,
                "content_type": ctype, "bytes": size,
                "reason": f"Too small ({size} bytes) — likely a placeholder/stub, not a real photo"}

    return {"url": url, "verdict": "safe", "status": status,
            "content_type": ctype or "image/*", "bytes": size,
            "reason": "Loads anonymously as a real image"}


def main(argv):
    args = argv[1:]
    if args == ["-"]:
        urls = json.load(sys.stdin)
    elif args:
        urls = args
    else:
        print(__doc__.strip())
        return 2
    results = [check(u) for u in urls]
    print(json.dumps(results, indent=2))
    # Exit non-zero if nothing is safe, so callers can branch on it.
    return 0 if any(r["verdict"] == "safe" for r in results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
