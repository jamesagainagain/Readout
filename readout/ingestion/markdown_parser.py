import re


def parse_markdown(text: str) -> list[dict]:
    """Split markdown into heading-based chunks.

    Returns list of {heading, content, level}.
    """
    if not text.strip():
        return []

    lines = text.split("\n")
    chunks: list[dict] = []
    current_heading = ""
    current_level = 0
    current_lines: list[str] = []

    for line in lines:
        match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if match:
            content = "\n".join(current_lines).strip()
            if content or current_heading:
                chunks.append(
                    {
                        "heading": current_heading,
                        "content": content,
                        "level": current_level,
                    }
                )
            current_heading = match.group(2).strip()
            current_level = len(match.group(1))
            current_lines = []
        else:
            current_lines.append(line)

    content = "\n".join(current_lines).strip()
    if content or current_heading:
        chunks.append(
            {"heading": current_heading, "content": content, "level": current_level}
        )

    return chunks
