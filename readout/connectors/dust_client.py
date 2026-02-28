"""Dust.tt API client for accessing Claude.

Dust uses a conversation-based API:
1. Create conversation with initial message
2. Stream events to get the assistant's reply
"""

import httpx

from readout.config import settings

BASE_URL = "https://dust.tt/api/v1/w"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.dust_api_key}",
        "Content-Type": "application/json",
    }


def _workspace_url(path: str = "") -> str:
    return f"{BASE_URL}/{settings.dust_workspace_id}{path}"


def chat_completion(
    system: str,
    messages: list[dict],
    model: str | None = None,
) -> str:
    """Send a message through Dust.tt and return the assistant's text reply.

    Args:
        system: System prompt context
        messages: List of {role, content} message dicts
        model: Model override (default from settings)

    Returns:
        The assistant's reply text.
    """
    # Create conversation with the first user message and context
    # Dust conversations work by creating a conversation, then posting messages
    # and reading back agent responses via events

    # Build the initial message content with system context prepended
    user_messages = [m for m in messages if m["role"] == "user"]
    if not user_messages:
        raise ValueError("At least one user message is required")

    # For Dust, we embed the system prompt as context in the first message
    first_message = user_messages[-1]["content"]
    context_message = f"""<context>
{system}
</context>

{first_message}"""

    model_id = model or settings.dust_model

    # Create conversation
    create_url = _workspace_url("/assistant/conversations")
    create_body = {
        "message": {
            "content": context_message,
            "mentions": [{"configurationId": model_id}],
            "context": {
                "timezone": "UTC",
                "username": "readout",
                "fullName": "Readout",
                "email": "readout@readout.dev",
                "profilePictureUrl": None,
            },
        },
        "visibility": "unlisted",
        "title": None,
    }

    with httpx.Client(timeout=120) as client:
        resp = client.post(create_url, headers=_headers(), json=create_body)
        resp.raise_for_status()
        data = resp.json()

        # Extract the assistant's reply from the conversation
        conversation = data.get("conversation", {})
        conv_id = conversation.get("sId")

        # The blocking response should include the agent's message
        # Look through conversation content for the agent's reply
        content = conversation.get("content", [])
        for turn in content:
            for message in turn:
                if message.get("type") == "agent_message":
                    # Agent message content might be in different formats
                    agent_content = message.get("content", "")
                    if agent_content:
                        return agent_content

        # Poll messages until agent reply is complete
        if conv_id:
            import time
            for _ in range(60):
                time.sleep(2)
                msg_url = _workspace_url(f"/assistant/conversations/{conv_id}")
                r = client.get(msg_url, headers=_headers())
                r.raise_for_status()
                conv_data = r.json().get("conversation", {})
                for turn in conv_data.get("content", []):
                    for message in turn:
                        if message.get("type") == "agent_message":
                            if message.get("status") == "succeeded":
                                agent_content = message.get("content", "")
                                if agent_content:
                                    return agent_content

    raise RuntimeError("No response received from Dust.tt")


def simple_completion(prompt: str, system: str = "") -> str:
    """Convenience wrapper for a single prompt → response."""
    return chat_completion(
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
