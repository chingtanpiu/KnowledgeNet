"""
Pydantic 模式定义 - API 请求/响应验证
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ==================== 标签 ====================

class TagBase(BaseModel):
    name: str = Field(..., max_length=64)
    color: str = Field(default="#3F51B5", max_length=16)


class TagCreate(TagBase):
    pass


class TagResponse(TagBase):
    id: str

    class Config:
        from_attributes = True


# ==================== 出处 ====================

class SourceBase(BaseModel):
    name: str = Field(..., max_length=256)


class SourceCreate(SourceBase):
    pass


class SourceResponse(SourceBase):
    id: str

    class Config:
        from_attributes = True


# ==================== 知识库 ====================

class LibraryBase(BaseModel):
    name: str = Field(..., max_length=128)
    description: Optional[str] = None


class LibraryCreate(LibraryBase):
    tags: list[TagCreate] = Field(default_factory=list)
    sources: list[SourceCreate] = Field(default_factory=list)


class LibraryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=128)
    description: Optional[str] = None
    tags: Optional[list[TagCreate]] = None
    sources: Optional[list[SourceCreate]] = None


class LibraryResponse(LibraryBase):
    id: str
    tags: list[TagResponse] = []
    sources: list[SourceResponse] = []
    created_at: datetime
    updated_at: datetime
    point_count: int = 0
    link_count: int = 0

    class Config:
        from_attributes = True


class LibraryListResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    point_count: int = 0
    link_count: int = 0

    class Config:
        from_attributes = True


# ==================== 知识点 ====================

class PointBase(BaseModel):
    title: str = Field(..., max_length=256)
    content: str
    source: Optional[str] = Field(None, max_length=256)
    page: Optional[str] = Field(None, max_length=32)
    x: float = 0.0
    y: float = 0.0


class PointCreate(PointBase):
    library_id: str
    tags: list[str] = Field(default_factory=list)  # 标签名称列表


class PointUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=256)
    content: Optional[str] = None
    source: Optional[str] = Field(None, max_length=256)
    page: Optional[str] = Field(None, max_length=32)
    x: Optional[float] = None
    y: Optional[float] = None
    tags: Optional[list[str]] = None  # 标签名称列表


class PointResponse(PointBase):
    id: str
    library_id: str
    tags: list[TagResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== 链接 ====================

class LinkBase(BaseModel):
    from_id: str = Field(..., alias="fromId")
    to_id: str = Field(..., alias="toId")
    type: str = Field(default="related")  # related, parent, child

    class Config:
        populate_by_name = True


class LinkCreate(LinkBase):
    library_id: Optional[str] = Field(None, alias="libraryId")

    class Config:
        populate_by_name = True


class LinkResponse(BaseModel):
    id: str
    from_id: str = Field(..., serialization_alias="fromId")
    to_id: str = Field(..., serialization_alias="toId")
    type: str
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


# ==================== 快照 ====================

class SnapshotResponse(BaseModel):
    id: str
    point_id: str
    title: str
    content: str
    source: Optional[str] = None
    page: Optional[str] = None
    links: Optional[dict] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class RestoreRequest(BaseModel):
    snapshot_id: str


# ==================== 词频统计 ====================

class WordFrequency(BaseModel):
    word: str
    count: int


class WordFrequencyResponse(BaseModel):
    mode: str  # "content" or "tag"
    data: list[WordFrequency]


# ==================== 导出 ====================

class ExportRequest(BaseModel):
    format: str = "json"  # json, markdown, csv
    tag_filter: Optional[list[str]] = None  # 按标签筛选


class BatchExportRequest(BaseModel):
    library_ids: list[str] = Field(default_factory=list)  # 空列表表示导出所有知识库
