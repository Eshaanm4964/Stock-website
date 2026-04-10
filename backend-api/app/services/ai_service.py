from __future__ import annotations

from typing import Any

from openai import AsyncOpenAI

from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """
You are Quantavia AI, an Indian market intelligence copilot.
Use only supplied portfolio, stock, indicators, and news context.
Explain market movement clearly, mention uncertainty, and never promise returns.
When asked for advice, provide balanced scenarios, risks, and educational insights instead of guarantees.
Format responses with short sections:
1. Market Read
2. Why It Moved
3. Portfolio Impact
4. Watchouts
""".strip()


async def generate_market_response(context: dict[str, Any], user_message: str) -> tuple[str, list[str]]:
    if not settings.openai_api_key:
        fallback = (
            "Market Read: AI provider is not configured.\n"
            "Why It Moved: Add the OpenAI API key to enable contextual explanations.\n"
            "Portfolio Impact: Current portfolio metrics are still available in the dashboard.\n"
            "Watchouts: This platform provides insights, not guaranteed advice."
        )
        return fallback, []

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    completion = await client.chat.completions.create(
        model=settings.openai_model,
        temperature=0.3,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion:\n{user_message}"},
        ],
    )
    content = completion.choices[0].message.content or "No response generated."
    citations = [article["url"] for article in context.get("news", []) if article.get("url")]
    return content, citations[:5]
