"""
SQLAlchemy 数据模型 - 知识图谱应用
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Float, ForeignKey, DateTime, JSON, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    """返回当前 UTC 时间"""
    return datetime.now(timezone.utc)


def generate_id() -> str:
    """生成唯一 ID"""
    import time
    import random
    return f"{int(time.time() * 1000):x}{random.randint(0, 0xFFFFFF):06x}"


# ==================== 关联表 ====================

# 知识点与标签的多对多关系
point_tag_table = Table(
    "point_tags",
    Base.metadata,
    Column("point_id", String(32), ForeignKey("points.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(32), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


# ==================== 模型定义 ====================

class Library(Base):
    """知识点网络库"""
    __tablename__ = "libraries"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=generate_id)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # 关系
    tags: Mapped[list["Tag"]] = relationship("Tag", back_populates="library", cascade="all, delete-orphan")
    sources: Mapped[list["Source"]] = relationship("Source", back_populates="library", cascade="all, delete-orphan")
    points: Mapped[list["Point"]] = relationship("Point", back_populates="library", cascade="all, delete-orphan")


class Tag(Base):
    """标签"""
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=generate_id)
    library_id: Mapped[str] = mapped_column(String(32), ForeignKey("libraries.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#3F51B5")

    # 关系
    library: Mapped["Library"] = relationship("Library", back_populates="tags")
    points: Mapped[list["Point"]] = relationship("Point", secondary=point_tag_table, back_populates="tags")


class Source(Base):
    """出处"""
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=generate_id)
    library_id: Mapped[str] = mapped_column(String(32), ForeignKey("libraries.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)

    # 关系
    library: Mapped["Library"] = relationship("Library", back_populates="sources")


class Point(Base):
    """知识点"""
    __tablename__ = "points"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=generate_id)
    library_id: Mapped[str] = mapped_column(String(32), ForeignKey("libraries.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    page: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # 关系
    library: Mapped["Library"] = relationship("Library", back_populates="points")
    tags: Mapped[list["Tag"]] = relationship("Tag", secondary=point_tag_table, back_populates="points")
    snapshots: Mapped[list["Snapshot"]] = relationship("Snapshot", back_populates="point", cascade="all, delete-orphan")

    # 链接关系（作为起点）
    outgoing_links: Mapped[list["Link"]] = relationship(
        "Link", foreign_keys="Link.from_id", back_populates="from_point", cascade="all, delete-orphan"
    )
    # 链接关系（作为终点）
    incoming_links: Mapped[list["Link"]] = relationship(
        "Link", foreign_keys="Link.to_id", back_populates="to_point", cascade="all, delete-orphan"
    )


class Link(Base):
    """知识点之间的链接"""
    __tablename__ = "links"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=generate_id)
    from_id: Mapped[str] = mapped_column(String(32), ForeignKey("points.id", ondelete="CASCADE"), nullable=False)
    to_id: Mapped[str] = mapped_column(String(32), ForeignKey("points.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(32), default="related")  # related, parent, child
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # 关系
    from_point: Mapped["Point"] = relationship("Point", foreign_keys=[from_id], back_populates="outgoing_links")
    to_point: Mapped["Point"] = relationship("Point", foreign_keys=[to_id], back_populates="incoming_links")


class Snapshot(Base):
    """知识点版本快照"""
    __tablename__ = "snapshots"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=generate_id)
    point_id: Mapped[str] = mapped_column(String(32), ForeignKey("points.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    page: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    links: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # 存储链接 ID 列表
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # 关系
    point: Mapped["Point"] = relationship("Point", back_populates="snapshots")
