"""Intelligent subreddit discovery: product knowledge + brief → ranked subreddit list."""

import json
import re
import time

from readout.connectors.dust_client import chat_completion
from readout.connectors.reddit_client import fetch_subreddit_metadata, search_subreddits
from readout.connectors.supabase_client import get_brief, get_product_knowledge, upsert_subreddits
from readout.models.schemas import SubredditInfo

_QUERY_SYSTEM = """You are a Reddit expert. Given a product description and audience brief,
return 4-5 search queries to find relevant subreddits. These queries will be fed to Reddit's
subreddit search. Return ONLY a JSON array of strings, e.g. ["query1", "query2"].
No explanation, no markdown."""

_RANK_SYSTEM = """You are a Reddit expert. Given a list of subreddits and a product description,
rank the top subreddits by relevance and explain in one sentence why each fits.
Return a JSON array where each object has "name" and "rationale".
Only include subreddits that are genuinely relevant. Return at most 10."""


def _extract_queries(raw: str) -> list[str]:
    match = re.search(r"\[.*?\]", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    # Fallback: split lines
    return [line.strip().strip('"') for line in raw.splitlines() if line.strip()]


def _extract_ranked(raw: str) -> list[dict]:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


def _build_product_context(knowledge: dict, brief: dict) -> str:
    summary = knowledge.get("summary") or {}
    return "\n".join([
        f"Product: {summary.get('product_description', 'N/A')}",
        f"Audience: {brief.get('audience', summary.get('audience', 'N/A'))}",
        f"Tone: {brief.get('tone', 'N/A')}",
        f"Goals: {brief.get('goals', 'N/A')}",
        f"Differentiators: {', '.join(summary.get('differentiators', []) or [])}",
        f"Tech stack: {', '.join(summary.get('tech_stack', []) or [])}",
    ])


def discover_subreddits(
    brief_id: str,
    min_subscribers: int = 1000,
    per_query_limit: int = 15,
    persist: bool = True,
) -> list[SubredditInfo]:
    """Discover relevant subreddits for a brief using LLM + Reddit search.

    Flow:
    1. LLM generates search queries from product knowledge + brief
    2. Reddit API searches each query; results merged and deduped
    3. Filter by min_subscribers and SFW
    4. LLM ranks and adds one-line rationale
    5. Optionally upsert to Supabase subreddits table

    Args:
        brief_id: Supabase brief ID.
        min_subscribers: Minimum subscriber count to include.
        per_query_limit: Max subreddits per search query.
        persist: Whether to upsert results to Supabase.

    Returns:
        Ranked list of SubredditInfo objects.
    """
    brief = get_brief(brief_id)
    knowledge = get_product_knowledge(brief["knowledge_id"])
    context = _build_product_context(knowledge, brief)

    # Step 1: LLM → search queries
    raw_queries = chat_completion(
        system=_QUERY_SYSTEM,
        messages=[{"role": "user", "content": context}],
    )
    queries = _extract_queries(raw_queries)[:5]

    # Step 2: Reddit search for each query; merge and dedupe by name
    seen: dict[str, dict] = {}
    for query in queries:
        results = search_subreddits(query, limit=per_query_limit)
        for sub in results:
            name = sub["name"].lower()
            if name not in seen:
                seen[name] = sub
        time.sleep(0.5)

    # Step 3: filter
    candidates = [
        s for s in seen.values()
        if not s.get("over18") and (s.get("subscribers") or 0) >= min_subscribers
    ]
    # Sort by subscribers descending before passing to ranker
    candidates.sort(key=lambda s: s.get("subscribers") or 0, reverse=True)
    top_candidates = candidates[:30]

    if not top_candidates:
        return []

    # Step 4: LLM ranks and adds rationale
    candidates_text = "\n".join(
        f"- r/{s['name']} ({s.get('subscribers', 0):,} subscribers): {s.get('public_description', '')[:120]}"
        for s in top_candidates
    )
    rank_prompt = f"{context}\n\nCandidate subreddits:\n{candidates_text}"
    raw_ranked = chat_completion(
        system=_RANK_SYSTEM,
        messages=[{"role": "user", "content": rank_prompt}],
    )
    ranked = _extract_ranked(raw_ranked)

    # Build SubredditInfo list, joining with subscriber counts from candidates
    sub_map = {s["name"].lower(): s for s in top_candidates}
    results_out: list[SubredditInfo] = []
    for item in ranked:
        name = item.get("name", "").lstrip("r/").strip()
        meta = sub_map.get(name.lower(), {})
        results_out.append(SubredditInfo(
            name=name,
            description=meta.get("public_description"),
            subscribers=meta.get("subscribers"),
            rationale=item.get("rationale"),
        ))

    # Step 5: persist to Supabase
    if persist and results_out:
        rows = [
            {
                "name": s.name,
                "public_description": s.description,
                "subscribers": s.subscribers,
                "topic": brief.get("goals", ""),
            }
            for s in results_out
        ]
        upsert_subreddits(rows)

    return results_out


def discover_subreddits_from_queries(
    queries: list[str],
    min_subscribers: int = 1000,
    per_query_limit: int = 15,
) -> list[SubredditInfo]:
    """Discover subreddits from explicit queries (no LLM step, no persistence).
    Useful for testing or direct API use."""
    seen: dict[str, dict] = {}
    for query in queries:
        for sub in search_subreddits(query, limit=per_query_limit):
            name = sub["name"].lower()
            if name not in seen:
                seen[name] = sub
        time.sleep(0.5)

    candidates = [
        s for s in seen.values()
        if not s.get("over18") and (s.get("subscribers") or 0) >= min_subscribers
    ]
    candidates.sort(key=lambda s: s.get("subscribers") or 0, reverse=True)

    return [
        SubredditInfo(
            name=s["name"],
            description=s.get("public_description"),
            subscribers=s.get("subscribers"),
        )
        for s in candidates
    ]
