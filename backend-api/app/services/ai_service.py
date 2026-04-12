from __future__ import annotations

from typing import Any

import httpx
from openai import AsyncOpenAI

from app.core.config import get_settings

settings = get_settings()

SYSTEM_PROMPT = """
You are Yantra AI, an Indian NSE market and portfolio assistant.
Use only supplied portfolio, stock, indicators, and news context.
Explain market movement clearly, mention uncertainty, and never promise returns.
When asked for advice, provide balanced scenarios, risks, and educational insights instead of guarantees.
If the user asks about the platform, explain Yantra features simply: admin dashboard, user dashboard, portfolio holdings, live prices, P/L, OTP login, reviews, and reports.
Format responses with short sections:
1. Market Read
2. Why It Moved
3. Portfolio Impact
4. Watchouts
""".strip()


async def generate_market_response(context: dict[str, Any], user_message: str) -> tuple[str, list[str]]:
    xai_key = settings.xai_api_key if not settings.xai_api_key.startswith("gsk_") else ""
    groq_key = settings.groq_api_key or (settings.xai_api_key if settings.xai_api_key.startswith("gsk_") else "")
    provider_key = groq_key or xai_key or settings.openai_api_key
    provider_model = (
        settings.groq_model if groq_key else settings.xai_model if xai_key else settings.openai_model
    )
    base_url = settings.groq_base_url if groq_key else settings.xai_base_url if xai_key else None

    if not provider_key:
        fallback = (
            "Market Read: AI provider is not configured.\n"
            "Why It Moved: Add a valid Grok/xAI API key, or a Groq/OpenAI fallback key, to enable contextual explanations.\n"
            "Portfolio Impact: Current portfolio metrics are still available in the dashboard.\n"
            "Watchouts: This platform provides insights, not guaranteed advice."
        )
        return fallback, []

    client_kwargs: dict[str, Any] = {"api_key": provider_key}
    if base_url:
        client_kwargs["base_url"] = base_url
        client_kwargs["timeout"] = httpx.Timeout(60.0)

    client = AsyncOpenAI(**client_kwargs)
    prompt_input = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion:\n{user_message}"},
    ]

    try:
        completion = await client.chat.completions.create(
            model=provider_model,
            temperature=0.3,
            messages=prompt_input,
        )
        content = completion.choices[0].message.content or "No response generated."
    except Exception:
        provider_name = "Groq fallback" if groq_key else "Grok/xAI" if xai_key else "OpenAI"
        content = (
            "Market Read: The AI assistant is connected in the app, but the live AI provider did not return a response.\n"
            f"Why It Moved: Check the {provider_name} key, model name, billing, and network access on the backend server.\n"
            "Portfolio Impact: Dashboard live prices, holdings, and P/L calculations can still be reviewed normally.\n"
            "Watchouts: For the client demo, the assistant will fail gracefully instead of breaking the page."
        )

    citations = [article["url"] for article in context.get("news", []) if article.get("url")]
    return content, citations[:5]
