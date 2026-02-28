import base64

import httpx

from readout.config import settings

GITHUB_API = "https://api.github.com"


def _headers(token: str | None = None) -> dict:
    t = token or settings.github_token
    h = {"Accept": "application/vnd.github.v3+json"}
    if t:
        h["Authorization"] = f"Bearer {t}"
    return h


def _get(url: str, token: str | None = None) -> dict | list:
    resp = httpx.get(url, headers=_headers(token), timeout=30, follow_redirects=True)
    resp.raise_for_status()
    return resp.json()


def fetch_repo_contents(
    owner: str,
    repo: str,
    paths: list[str] | None = None,
    token: str | None = None,
) -> list[dict]:
    """Fetch file contents from a GitHub repo.

    Returns list of {path, content} dicts. Fetches README + docs/ by default.
    """
    if paths is None:
        paths = ["README.md", "README", "README.rst", "docs"]

    results: list[dict] = []

    for path in paths:
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{path}"
        try:
            data = _get(url, token)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                continue
            raise

        if isinstance(data, list):
            for item in data:
                if item.get("type") == "file" and item["name"].endswith(
                    (".md", ".txt", ".rst")
                ):
                    file_data = _get(item["url"], token)
                    content = base64.b64decode(file_data["content"]).decode("utf-8")
                    results.append({"path": item["path"], "content": content})
        elif isinstance(data, dict) and data.get("content"):
            content = base64.b64decode(data["content"]).decode("utf-8")
            results.append({"path": data["path"], "content": content})

    if not results:
        root = _get(f"{GITHUB_API}/repos/{owner}/{repo}/contents/", token)
        for item in root:
            if item.get("type") == "file" and item["name"].upper().startswith("README"):
                file_data = _get(item["url"], token)
                content = base64.b64decode(file_data["content"]).decode("utf-8")
                results.append({"path": item["path"], "content": content})
                break

    if not results:
        raise ValueError(f"No readable files found in {owner}/{repo}")

    return results
