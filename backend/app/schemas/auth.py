"""Request and response models for the auth routes."""

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class SessionStatus(BaseModel):
    authenticated: bool


class MessageResponse(BaseModel):
    message: str
