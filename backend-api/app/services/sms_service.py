import re

import httpx

from app.core.config import get_settings


class SmsDeliveryError(RuntimeError):
    pass


def normalize_indian_mobile(phone_number: str) -> str:
    digits = re.sub(r"\D", "", phone_number or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10:
        raise SmsDeliveryError("Enter a valid 10-digit Indian mobile number.")
    return digits


async def send_login_otp(phone_number: str, otp_code: str) -> None:
    settings = get_settings()
    provider = settings.sms_provider.strip().lower()
    if not provider or provider in {"debug", "none"}:
        raise SmsDeliveryError("Live SMS provider is not configured.")
    if provider != "fast2sms":
        raise SmsDeliveryError(f"Unsupported SMS provider: {settings.sms_provider}")
    if not settings.sms_api_key:
        raise SmsDeliveryError("Fast2SMS API key is missing.")

    mobile = normalize_indian_mobile(phone_number)
    payload = {
        "authorization": settings.sms_api_key,
        "route": "otp",
        "variables_values": otp_code,
        "flash": "0",
        "numbers": mobile,
    }
    headers = {"cache-control": "no-cache"}

    try:
        async with httpx.AsyncClient(timeout=settings.sms_timeout_seconds) as client:
            response = await client.get("https://www.fast2sms.com/dev/bulkV2", params=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise SmsDeliveryError("Could not connect to the SMS provider.") from exc

    try:
        body = response.json()
    except ValueError as exc:
        raise SmsDeliveryError("SMS provider returned an invalid response.") from exc

    if response.status_code >= 400:
        message = body.get("message") or body.get("error") or body.get("authorization")
        if isinstance(message, list):
            message = " ".join(str(item) for item in message)
        raise SmsDeliveryError(str(message or "SMS provider rejected the OTP request."))

    if body.get("return") is not True:
        message = body.get("message") or body.get("authorization") or "SMS provider could not send the OTP."
        if isinstance(message, list):
            message = " ".join(str(item) for item in message)
        raise SmsDeliveryError(str(message))
