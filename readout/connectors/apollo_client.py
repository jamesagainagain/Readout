"""Apollo.io API client for lead sourcing (People Search).

Uses the mixed_people/api_search endpoint. It does not return email addresses;
use Apollo's People Enrichment for that. This client returns lead records
(id, name, title, organization) for display and for later enrichment or CSV export.
"""

import httpx

from readout.config import settings

BASE_URL = "https://api.apollo.io/api/v1"


def search_people(
    title: str | None = None,
    industry: str | None = None,
    company_size: str | None = None,
    page: int = 1,
    per_page: int = 25,
) -> list[dict]:
    """Search Apollo for people matching persona filters.

    Returns a list of lead dicts with: id, first_name, last_name, title,
    organization_name, linkedin_url (optional). Email is not returned by
    the search endpoint; use Apollo's Enrichment API or UI for that.

    Raises:
        ValueError: If Apollo API key is not configured.
        httpx.HTTPStatusError: On 401/403 (invalid key) or other API errors.
    """
    if not settings.apollo_api_key:
        raise ValueError("Apollo API key is not configured")

    params: dict[str, str | int | list[str]] = {
        "page": page,
        "per_page": min(per_page, 100),
    }
    if title:
        params["person_titles[]"] = [title]
    if industry:
        params["q_keywords"] = industry
    if company_size:
        # Apollo expects ranges like "1,10" or "51,200"
        params["organization_num_employees_ranges[]"] = [company_size]

    # Flatten array params for query string: person_titles[]=CTO
    query_list: list[tuple[str, str]] = []
    for k, v in params.items():
        if isinstance(v, list):
            for item in v:
                query_list.append((k, str(item)))
        else:
            query_list.append((k, str(v)))

    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"{BASE_URL}/mixed_people/api_search",
            headers={
                "x-api-key": settings.apollo_api_key,
                "Cache-Control": "no-cache",
                "Content-Type": "application/json",
            },
            params=query_list,
        )
        resp.raise_for_status()
    data = resp.json()
    people = data.get("people") or []

    leads = []
    for p in people:
        org = p.get("organization") or {}
        leads.append({
            "id": p.get("id"),
            "first_name": p.get("first_name") or "",
            "last_name": p.get("last_name_obfuscated") or p.get("last_name") or "",
            "title": p.get("title"),
            "organization_name": org.get("name"),
            "linkedin_url": p.get("linkedin_url"),
            "email": p.get("email"),  # None from search; set if you add Enrichment later
        })
    return leads
