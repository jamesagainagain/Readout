"""Google AI (Gemini 2.5 Flash) client — drop-in replacement for the old Dust client.

Exposes the same chat_completion / simple_completion interface so nothing
else in the codebase needs to change.
"""

from google import genai
from google.genai import types

from readout.config import settings

_MODEL = "gemini-2.5-flash"


def chat_completion(
    system: str,
    messages: list[dict],
    model: str | None = None,
) -> str:
    """Send a message to Gemini 2.5 Flash and return the reply text."""
    user_messages = [m for m in messages if m["role"] == "user"]
    if not user_messages:
        raise ValueError("At least one user message is required")

    user_content = user_messages[-1]["content"]
    client = genai.Client(api_key=settings.google_ai_api_key)

    config = types.GenerateContentConfig(
        system_instruction=system if system else None,
    )
    response = client.models.generate_content(
        model=model or _MODEL,
        contents=user_content,
        config=config,
    )
    return response.text


def simple_completion(prompt: str, system: str = "") -> str:
    """Convenience wrapper for a single prompt → response."""
    return chat_completion(
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
