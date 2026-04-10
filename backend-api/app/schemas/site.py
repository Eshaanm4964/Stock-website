from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SiteSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    show_faq_insights: bool
    chat_nudges_enabled: bool
    updated_at: datetime | None = None


class SiteSettingsUpdateRequest(BaseModel):
    show_faq_insights: bool
    chat_nudges_enabled: bool
