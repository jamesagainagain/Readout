import os

import pytest

from readout.ingestion.summarizer import summarize_product


@pytest.fixture
def sample_chunks():
    return [
        {
            "heading": "MyTool",
            "content": "A CLI tool for automating deployments to AWS.",
            "level": 1,
        },
        {
            "heading": "Features",
            "content": "- Zero-downtime deploys\n- Rollback support\n- Multi-region",
            "level": 2,
        },
        {
            "heading": "Installation",
            "content": "pip install mytool",
            "level": 2,
        },
    ]


@pytest.mark.skipif(
    not os.environ.get("GOOGLE_AI_API_KEY"), reason="No Google AI API key"
)
def test_summarize_returns_structured_output(sample_chunks):
    summary = summarize_product(sample_chunks)
    assert "product_description" in summary
    assert isinstance(summary["features"], list)
    assert len(summary["features"]) > 0
    assert "audience" in summary
    assert isinstance(summary["differentiators"], list)
    assert isinstance(summary["tech_stack"], list)


def test_summarize_empty_chunks():
    with pytest.raises(ValueError):
        summarize_product([])
