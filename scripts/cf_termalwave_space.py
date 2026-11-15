#!/usr/bin/env python3
"""Create/update Cloudflare zone + DNS for termalwave.space. Reads secrets.local.toml."""
from __future__ import annotations

import json
import sys
import tomllib
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN_IP = "159.195.157.171"
ZONE = "termalwave.space"


def api(token: str, method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4" + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        raise SystemExit(f"CF API {method} {path} -> {e.code}: {raw}") from e


def main() -> int:
    secrets = tomllib.loads((ROOT / "config" / "secrets.local.toml").read_text())
    token = secrets["cloudflare"]["API_TOKEN"]
    account = secrets["cloudflare"]["ACCOUNT_ID"]
    v = api(token, "GET", "/user/tokens/verify")
    if not v.get("success"):
        print("token invalid", v, file=sys.stderr)
        return 2
    print("token ok")

    z = api(token, "GET", f"/zones?name={urllib.parse.quote(ZONE)}")
    zones = z.get("result") or []
    if not zones:
        created = api(
            token,
            "POST",
            "/zones",
            {"name": ZONE, "account": {"id": account}, "jump_start": False, "type": "full"},
        )
        if not created.get("success"):
            print(created, file=sys.stderr)
            return 2
        zone = created["result"]
        print("zone created", zone["id"])
    else:
        zone = zones[0]
        print("zone exists", zone["id"], zone["status"])

    zone_id = zone["id"]
    ns = zone.get("name_servers") or []
    print("nameservers:", " ".join(ns))

    wanted = [
        ("A", "@", ORIGIN_IP, True),
        ("A", "www", ORIGIN_IP, True),
        ("A", "mission", ORIGIN_IP, True),
        # c is Workers custom hostname; CNAME to workers.dev placeholder until attach
        ("CNAME", "c", f"termalwave-preview.{account}.workers.dev".replace(account, "workers"), True),
    ]
    # Better: list existing, upsert A records for apex/www/mission; leave c for wrangler routes
    existing = api(token, "GET", f"/zones/{zone_id}/dns_records?per_page=100")
    by_name: dict[tuple[str, str], dict] = {}
    for r in existing.get("result") or []:
        by_name[(r["type"], r["name"])] = r

    def fqdn(name: str) -> str:
        return ZONE if name in ("@", ZONE) else f"{name}.{ZONE}"

    for typ, name, content, proxied in [
        ("A", "@", ORIGIN_IP, True),
        ("A", "www", ORIGIN_IP, True),
        ("A", "mission", ORIGIN_IP, True),
    ]:
        full = fqdn(name)
        key = (typ, full)
        body = {"type": typ, "name": name if name != "@" else ZONE, "content": content, "proxied": proxied, "ttl": 1}
        if key in by_name:
            rid = by_name[key]["id"]
            out = api(token, "PUT", f"/zones/{zone_id}/dns_records/{rid}", body)
            print("updated", typ, full, out.get("success"))
        else:
            # name for apex should be the zone name
            body["name"] = ZONE if name == "@" else name
            out = api(token, "POST", f"/zones/{zone_id}/dns_records", body)
            print("created", typ, full, out.get("success"))

    print("NEXT: set registrar NS to:", " ".join(ns))
    print("THEN: wrangler deploy + custom domain c.termalwave.space")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
