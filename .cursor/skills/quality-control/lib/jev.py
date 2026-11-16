import json
import os
import time
import urllib.error
import urllib.request

BASE_URL = (
    os.environ.get("JEV_API_BASE_URL")
    or os.environ.get("TYPESAFE_BASE_URL")
    or "https://api.typesafe.ai"
)
MODEL = (
    os.environ.get("JEV_MODEL")
    or os.environ.get("TYPESAFE_DEFAULT_MODEL")
    or "jev-1.14.0"
)
RETRY_CODES = (429, 500, 502, 503, 504, 529)
TRIES = 4


class JevError(RuntimeError):
    pass


def api_key():
    key = os.environ.get("JEV_API_KEY") or os.environ.get("TYPESAFE_API_KEY")
    if not key:
        raise JevError("JEV_API_KEY or TYPESAFE_API_KEY is not set")
    return key


def result(payload):
    # the hosted Jev API wraps the result, older TypeSafe responses do not
    model = payload.get("model")
    if "code" in payload:
        if payload.get("code") != 0:
            raise JevError("code %s: %s" % (payload.get("code"), payload.get("message", "")))
        payload = payload.get("data", {}).get("result", {})
        if model and "model" not in payload:
            payload["model"] = model
    if "answers" not in payload:
        raise JevError("response has no answers")
    return payload


def ask(state, questions):
    req = urllib.request.Request(
        BASE_URL.rstrip("/") + "/v1/systemone",
        data=json.dumps({"model": MODEL, "state": state, "questions": questions}).encode(),
        headers={"Authorization": "Bearer " + api_key(), "Content-Type": "application/json"},
    )
    for attempt in range(TRIES):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                return result(json.load(res))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            if e.code == 401:
                raise JevError("401: invalid API key for %s" % BASE_URL) from e
            if e.code == 402:
                raise JevError("402: no credits for %s" % BASE_URL) from e
            if e.code not in RETRY_CODES or attempt == TRIES - 1:
                raise JevError("%d: %s" % (e.code, body)) from e
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == TRIES - 1:
                raise JevError("unreachable: %s" % e) from e
        except ValueError as e:
            raise JevError("bad response: %s" % e) from e
        # 429 and 5xx are transient, the api docs ask for exponential backoff
        time.sleep(2 ** attempt)
