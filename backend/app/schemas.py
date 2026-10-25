"""Validated request models for mutable Cyvera resources."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Severity = Literal["critical", "high", "medium", "low", "info"]
AlertStatus = Literal["open", "investigating", "resolved"]


class AlertStatusUpdate(BaseModel):
    status: AlertStatus


class SignaturePayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=1, max_length=1000)
    pattern: str = Field(min_length=1, max_length=512)
    severity: Severity
    category: str = Field(min_length=2, max_length=80)
    author: str = Field(default="soc.team", min_length=1, max_length=120)
    enabled: bool = True


class SettingsPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    orgName: str | None = Field(default=None, max_length=120)
    organization: str | None = Field(default=None, max_length=120)
    analyst: str | None = Field(default=None, max_length=120)
    retentionDays: int | None = Field(default=None, ge=7, le=365)
    alertRetentionDays: int | None = Field(default=None, ge=30, le=730)
    defaultSeverity: Literal["critical", "high", "medium", "low"] | None = None
    severityThreshold: Severity | None = None
    emailNotifications: bool | None = None
    slackNotifications: bool | None = None
    autoBlockCritical: bool | None = None
    autoEnable: bool | None = None
    refreshIntervalSec: int | None = Field(default=None, ge=5, le=300)
