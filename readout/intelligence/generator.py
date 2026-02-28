"""Channel-specific draft generator using the Dust/Claude LLM."""

import json
import re

from readout.connectors.dust_client import chat_completion
from readout.connectors.supabase_client import (
    create_brief,
    get_brief,
    get_product_knowledge,
    save_drafts,
)
from readout.intelligence.templates import get_system_prompt
from readout.models.schemas import Draft


def _build_user_prompt(
    knowledge: dict,
    brief: dict,
    channel: str,
    subreddit: str | None = None,
    count: int = 3,
) -> str:
    summary = knowledge.get("summary") or {}
    chunks = knowledge.get("chunks") or []

    chunks_text = "\n\n".join(
        f"### {c.get('heading', '')} (level {c.get('level', 1)})\n{c.get('content', '')}"
        for c in chunks[:10]  # limit context size
    )

    lines = [
        f"Product description: {summary.get('product_description', 'N/A')}",
        f"Audience: {summary.get('audience', brief.get('audience', 'N/A'))}",
        f"Differentiators: {', '.join(summary.get('differentiators', []) or [])}",
        f"Tech stack: {', '.join(summary.get('tech_stack', []) or [])}",
        "",
        f"Campaign brief:",
        f"- Target audience: {brief.get('audience', 'N/A')}",
        f"- Tone: {brief.get('tone', 'N/A')}",
        f"- Goals: {brief.get('goals', 'N/A')}",
        f"- Constraints: {brief.get('constraints', 'none')}",
    ]

    if subreddit:
        lines.append(f"\nTarget subreddit: r/{subreddit}")

    if chunks_text:
        lines += ["", "Documentation context:", chunks_text]

    lines += [
        "",
        f"Generate {count} distinct {channel} draft(s) for this product.",
        "Return a JSON array of objects, each with 'title' and 'body' keys.",
        "Example: [{\"title\": \"...\", \"body\": \"...\"}, ...]",
    ]

    return "\n".join(lines)


def _parse_drafts(raw: str, channel: str, count: int) -> list[Draft]:
    """Extract draft objects from LLM response text."""
    # Try to extract a JSON array from the response
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        try:
            items = json.loads(match.group())
            return [
                Draft(
                    channel=channel,
                    title=item.get("title"),
                    body=item.get("body", ""),
                )
                for item in items[:count]
            ]
        except json.JSONDecodeError:
            pass

    # Fallback: try as single object
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            item = json.loads(match.group())
            return [Draft(channel=channel, title=item.get("title"), body=item.get("body", ""))]
        except json.JSONDecodeError:
            pass

    # Last resort: treat whole response as body
    return [Draft(channel=channel, title=None, body=raw.strip())]


def generate_drafts(
    brief_id: str,
    channel: str,
    count: int = 3,
    subreddit: str | None = None,
    save: bool = True,
) -> list[Draft]:
    """Generate channel-specific drafts for a brief.

    Args:
        brief_id: ID of the brief in Supabase.
        channel: One of 'reddit', 'email', 'linkedin'.
        count: Number of drafts to generate.
        subreddit: Optional target subreddit (used for reddit channel).
        save: Whether to persist drafts to Supabase.

    Returns:
        List of Draft objects.
    """
    brief = get_brief(brief_id)
    knowledge = get_product_knowledge(brief["knowledge_id"])
    system = get_system_prompt(channel)
    user_prompt = _build_user_prompt(knowledge, brief, channel, subreddit, count)

    raw = chat_completion(
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
    )

    drafts = _parse_drafts(raw, channel, count)

    if save and drafts:
        rows = [
            {
                "channel": d.channel,
                "title": d.title,
                "body": d.body,
                "metadata": {"subreddit": subreddit} if subreddit else {},
            }
            for d in drafts
        ]
        save_drafts(brief_id, rows)

    return drafts
