import json

import google.generativeai as genai

from readout.config import settings

SUMMARIZE_PROMPT = """You are analyzing a software product's documentation to create a structured summary.

Given these documentation chunks from the product's repo (README first, then docs), produce a JSON object with:
- "product_description": 2-3 sentence description of what the product does
- "features": list of key features (strings)
- "audience": who this product is for (one sentence)
- "differentiators": what makes it unique vs alternatives (list of strings)
- "tech_stack": technologies/languages used (list of strings, inferred from docs)

Respond with ONLY valid JSON, no markdown fencing.

Documentation chunks:
{chunks_text}
"""


def summarize_product(chunks: list[dict]) -> dict:
    """Use Gemini to summarize product knowledge from parsed markdown chunks.

    Returns dict with: product_description, features, audience, differentiators, tech_stack.
    """
    if not chunks:
        raise ValueError("No chunks to summarize")

    genai.configure(api_key=settings.google_ai_api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    chunks_text = "\n\n".join(
        f"### {c['heading']} (level {c['level']})\n{c['content']}" for c in chunks
    )

    response = model.generate_content(SUMMARIZE_PROMPT.format(chunks_text=chunks_text))
    text = response.text.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    return json.loads(text)
