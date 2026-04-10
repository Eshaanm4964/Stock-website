from pydantic import BaseModel, EmailStr


class UserUpdateRequest(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    phone_number: str | None = None
    bio: str | None = None
