import re
from urllib.parse import quote

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
    if provider not in {"fast2sms", "2factor", "twofactor"}:
        raise SmsDeliveryError(f"Unsupported SMS provider: {settings.sms_provider}")
    if not settings.sms_api_key:
        raise SmsDeliveryError(f"{settings.sms_provider} API key is missing.")

    mobile = normalize_indian_mobile(phone_number)
    if provider in {"2factor", "twofactor"}:
        await _send_2factor_otp(settings.sms_api_key, mobile, otp_code, settings.sms_timeout_seconds)
        return

    await _send_fast2sms_otp(settings.sms_api_key, mobile, otp_code, settings.sms_timeout_seconds)


async def _send_2factor_otp(api_key: str, mobile: str, otp_code: str, timeout_seconds: float) -> None:
    # 2Factor OTP API uses a generated OTP from our app and returns Status=Success on delivery request acceptance.
    encoded_key = quote(api_key.strip(), safe="")
    encoded_mobile = quote(mobile, safe="")
    encoded_otp = quote(otp_code, safe="")
    url = f"https://2factor.in/API/V1/{encoded_key}/SMS/{encoded_mobile}/{encoded_otp}"

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(url)
    except httpx.HTTPError as exc:
        raise SmsDeliveryError("Could not connect to the SMS provider.") from exc

    try:
        body = response.json()
    except ValueError as exc:
        raise SmsDeliveryError("SMS provider returned an invalid response.") from exc

    if response.status_code >= 400 or str(body.get("Status", "")).lower() != "success":
        detail = body.get("Details") or body.get("ErrorMessage") or body.get("Message")
        raise SmsDeliveryError(str(detail or "2Factor could not send the OTP."))


async def _send_fast2sms_otp(api_key: str, mobile: str, otp_code: str, timeout_seconds: float) -> None:
    payload = {
        "authorization": api_key,
        "route": "otp",
        "variables_values": otp_code,
        "flash": "0",
        "numbers": mobile,
    }
    headers = {"cache-control": "no-cache"}

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
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
