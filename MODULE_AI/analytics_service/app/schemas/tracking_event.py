from pydantic import BaseModel, Field, field_validator


class TrackItem(BaseModel):
    id: str
    bbox: list[float] = Field(min_length=4, max_length=4)

    @field_validator("bbox")
    @classmethod
    def bbox_must_be_ltrb(cls, v: list[float]) -> list[float]:
        left, top, right, bottom = v
        if right <= left or bottom <= top:
            raise ValueError(f"invalid bbox, expected [left, top, right, bottom]: {v}")
        return v


class TrackingEventSchema(BaseModel):
    camera_id: str
    location_id: str | None = None
    timestamp: float
    frame_width: int
    frame_height: int
    tracks: list[TrackItem]
