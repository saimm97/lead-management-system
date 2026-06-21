from pydantic import BaseModel, Field


class BulkUpdateRequest(BaseModel):
    ids: list[int] = Field(min_length=1)
    updates: dict = Field(default_factory=dict)


class BulkUpdateResult(BaseModel):
    updated: int
    failed: int
    errors: list[str] = Field(default_factory=list)
