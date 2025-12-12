"""
CRUD 操作 - 数据库增删改查
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, delete, func
from sqlalchemy.orm import Session, selectinload

from .models import Library, Tag, Source, Point, Link, Snapshot, point_tag_table, generate_id


# ==================== 知识库 ====================

def get_libraries(db: Session) -> list[Library]:
    """获取所有知识库"""
    return list(db.scalars(select(Library).order_by(Library.created_at.desc())).all())


def get_library(db: Session, library_id: str) -> Optional[Library]:
    """获取单个知识库（含标签和出处）"""
    return db.scalar(
        select(Library)
        .options(selectinload(Library.tags), selectinload(Library.sources))
        .where(Library.id == library_id)
    )


def create_library(db: Session, name: str, description: Optional[str] = None,
                   tags: list[dict] = None, sources: list[dict] = None) -> Library:
    """创建知识库"""
    library = Library(name=name, description=description)
    db.add(library)
    db.flush()  # 获取 ID

    # 添加标签
    if tags:
        for tag_data in tags:
            tag = Tag(library_id=library.id, name=tag_data["name"], color=tag_data.get("color", "#3F51B5"))
            db.add(tag)

    # 添加出处
    if sources:
        for source_data in sources:
            source = Source(library_id=library.id, name=source_data["name"])
            db.add(source)

    db.commit()
    db.refresh(library)
    return library


def update_library(db: Session, library_id: str, name: Optional[str] = None,
                   description: Optional[str] = None, tags: list[dict] = None,
                   sources: list[dict] = None) -> Optional[Library]:
    """更新知识库"""
    library = get_library(db, library_id)
    if not library:
        return None

    if name is not None:
        library.name = name
    if description is not None:
        library.description = description

    # 更新标签（删除旧的，添加新的）
    if tags is not None:
        # 删除旧标签
        db.execute(delete(Tag).where(Tag.library_id == library_id))
        # 添加新标签
        for tag_data in tags:
            tag = Tag(
                id=tag_data.get("id", generate_id()),
                library_id=library_id,
                name=tag_data["name"],
                color=tag_data.get("color", "#3F51B5")
            )
            db.add(tag)

    # 更新出处（删除旧的，添加新的）
    if sources is not None:
        db.execute(delete(Source).where(Source.library_id == library_id))
        for source_data in sources:
            source = Source(
                id=source_data.get("id", generate_id()),
                library_id=library_id,
                name=source_data["name"]
            )
            db.add(source)

    db.commit()
    db.refresh(library)
    return library


def delete_library(db: Session, library_id: str) -> bool:
    """删除知识库（级联删除所有知识点和链接）"""
    library = db.get(Library, library_id)
    if not library:
        return False
    db.delete(library)
    db.commit()
    return True


# ==================== 知识点 ====================

def get_points(db: Session, library_id: str) -> list[Point]:
    """获取知识库中的所有知识点"""
    return list(db.scalars(
        select(Point)
        .options(selectinload(Point.tags))
        .where(Point.library_id == library_id)
    ).all())


def get_point(db: Session, point_id: str) -> Optional[Point]:
    """获取单个知识点"""
    return db.scalar(
        select(Point)
        .options(selectinload(Point.tags))
        .where(Point.id == point_id)
    )


def create_point(db: Session, library_id: str, title: str, content: str,
                 source: Optional[str] = None, page: Optional[str] = None,
                 x: float = 0.0, y: float = 0.0, tag_names: list[str] = None) -> Point:
    """创建知识点"""
    point = Point(
        library_id=library_id,
        title=title,
        content=content,
        source=source,
        page=page,
        x=x,
        y=y
    )
    db.add(point)
    db.flush()

    # 关联标签
    if tag_names:
        tags = db.scalars(
            select(Tag).where(Tag.library_id == library_id, Tag.name.in_(tag_names))
        ).all()
        point.tags = list(tags)

    db.commit()
    db.refresh(point)

    # 创建初始快照
    _create_snapshot(db, point)

    return point


def update_point(db: Session, point_id: str, title: Optional[str] = None,
                 content: Optional[str] = None, source: Optional[str] = None,
                 page: Optional[str] = None, x: Optional[float] = None,
                 y: Optional[float] = None, tag_names: Optional[list[str]] = None) -> Optional[Point]:
    """更新知识点"""
    point = get_point(db, point_id)
    if not point:
        return None

    # 记录旧值用于快照
    old_content = point.content
    old_title = point.title

    if title is not None:
        point.title = title
    if content is not None:
        point.content = content
    if source is not None:
        point.source = source
    if page is not None:
        point.page = page
    if x is not None:
        point.x = x
    if y is not None:
        point.y = y

    # 更新标签
    if tag_names is not None:
        tags = db.scalars(
            select(Tag).where(Tag.library_id == point.library_id, Tag.name.in_(tag_names))
        ).all()
        point.tags = list(tags)

    db.commit()
    db.refresh(point)

    # 如果内容或标题发生变化，创建快照
    if old_content != point.content or old_title != point.title:
        _create_snapshot(db, point)

    return point


def delete_point(db: Session, point_id: str) -> bool:
    """删除知识点（级联删除链接）"""
    point = db.get(Point, point_id)
    if not point:
        return False
    db.delete(point)
    db.commit()
    return True


def count_points_by_tag(db: Session, library_id: str, tag_name: str) -> int:
    """统计某标签下的知识点数量"""
    result = db.scalar(
        select(func.count(Point.id))
        .join(point_tag_table)
        .join(Tag)
        .where(Point.library_id == library_id, Tag.name == tag_name)
    )
    return result or 0


def delete_points_by_tag(db: Session, library_id: str, tag_name: str) -> int:
    """删除某标签下的所有知识点"""
    # 先获取要删除的知识点
    points = db.scalars(
        select(Point)
        .join(point_tag_table)
        .join(Tag)
        .where(Point.library_id == library_id, Tag.name == tag_name)
    ).all()

    count = len(list(points))
    for point in points:
        db.delete(point)

    db.commit()
    return count


# ==================== 链接 ====================

def get_links(db: Session, library_id: str) -> list[Link]:
    """获取知识库中的所有链接"""
    # 获取该库所有知识点的 ID
    point_ids = db.scalars(
        select(Point.id).where(Point.library_id == library_id)
    ).all()

    if not point_ids:
        return []

    return list(db.scalars(
        select(Link).where(
            Link.from_id.in_(point_ids),
            Link.to_id.in_(point_ids)
        )
    ).all())


def create_link(db: Session, from_id: str, to_id: str, link_type: str = "related") -> Optional[Link]:
    """创建链接
    
    规则：
    1. 同方向同类型不能重复 (A→B type=x 只能一个)
    2. related 类型是双向的，A→B 和 B→A 视为同一关系，只能存在一个
    3. parent/child 类型不能互为父子 (A是B的父，则B不能是A的父)
    """
    # 规则1: 检查完全相同的链接
    existing_same = db.scalar(
        select(Link).where(
            Link.from_id == from_id,
            Link.to_id == to_id,
            Link.type == link_type
        )
    )
    if existing_same:
        return None

    # 规则2: related 类型检查反向
    if link_type == "related":
        existing_reverse = db.scalar(
            select(Link).where(
                Link.from_id == to_id,
                Link.to_id == from_id,
                Link.type == "related"
            )
        )
        if existing_reverse:
            return None

    # 规则3: parent/child 不能互为父子
    # 如果创建 A→B type=parent (A是B的父节点)
    # 则不能存在 B→A type=parent (B是A的父节点)
    # 同理 child 类型
    if link_type in ("parent", "child"):
        # 检查反向同类型
        existing_reverse = db.scalar(
            select(Link).where(
                Link.from_id == to_id,
                Link.to_id == from_id,
                Link.type == link_type
            )
        )
        if existing_reverse:
            return None

        # 还要检查互补类型
        # 如果A→B是parent，则B→A不能是child (因为这意味着A是B的父，同时B又是A的父)
        opposite_type = "child" if link_type == "parent" else "parent"
        existing_opposite = db.scalar(
            select(Link).where(
                Link.from_id == to_id,
                Link.to_id == from_id,
                Link.type == opposite_type
            )
        )
        if existing_opposite:
            return None

    link = Link(from_id=from_id, to_id=to_id, type=link_type)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def delete_link(db: Session, link_id: str) -> bool:
    """删除链接"""
    link = db.get(Link, link_id)
    if not link:
        return False
    db.delete(link)
    db.commit()
    return True


# ==================== 快照 ====================

def _create_snapshot(db: Session, point: Point) -> Snapshot:
    """内部方法：创建快照"""
    # 获取相关链接
    links = db.scalars(
        select(Link).where(
            (Link.from_id == point.id) | (Link.to_id == point.id)
        )
    ).all()
    link_data = {
        "outgoing": [l.to_id for l in links if l.from_id == point.id],
        "incoming": [l.from_id for l in links if l.to_id == point.id]
    }

    snapshot = Snapshot(
        point_id=point.id,
        title=point.title,
        content=point.content,
        source=point.source,
        page=point.page,
        links=link_data
    )
    db.add(snapshot)
    db.commit()
    return snapshot


def get_snapshots(db: Session, point_id: str, days: int = 300) -> list[Snapshot]:
    """获取知识点的快照历史（默认 300 天内）"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return list(db.scalars(
        select(Snapshot)
        .where(Snapshot.point_id == point_id, Snapshot.timestamp >= cutoff)
        .order_by(Snapshot.timestamp.desc())
    ).all())


def restore_snapshot(db: Session, point_id: str, snapshot_id: str) -> Optional[Point]:
    """从快照恢复知识点"""
    snapshot = db.get(Snapshot, snapshot_id)
    if not snapshot or snapshot.point_id != point_id:
        return None

    point = db.get(Point, point_id)
    if not point:
        return None

    point.title = snapshot.title
    point.content = snapshot.content
    point.source = snapshot.source
    point.page = snapshot.page

    db.commit()
    db.refresh(point)
    return point


# ==================== 词频统计 ====================

def get_word_frequency(db: Session, library_id: str, mode: str = "content") -> list[tuple[str, int]]:
    """获取词频统计"""
    import jieba

    points = get_points(db, library_id)

    word_count: dict[str, int] = {}

    if mode == "content":
        for point in points:
            words = jieba.cut(point.content)
            for word in words:
                word = word.strip()
                if len(word) > 1:  # 过滤单字
                    word_count[word] = word_count.get(word, 0) + 1
    else:  # tag mode
        for point in points:
            for tag in point.tags:
                word_count[tag.name] = word_count.get(tag.name, 0) + 1

    # 按频率排序
    sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
    return sorted_words[:100]  # 返回前 100 个
