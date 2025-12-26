"""
知识图谱应用 - FastAPI 后端入口
"""
import json
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import get_db, init_db
from . import crud, schemas

# 前端目录
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    init_db()
    yield
    # 关闭时清理（如果需要）


app = FastAPI(
    title="知识图谱 API",
    description="知识点网络库管理系统后端 API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 配置（允许前端跨域访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注意：静态文件服务在文件末尾挂载到根路径，确保 API 路由优先


# ==================== 知识库 API ====================

@app.get("/api/libraries", response_model=list[schemas.LibraryListResponse])
def list_libraries(db: Session = Depends(get_db)):
    """获取所有知识库列表"""
    return crud.get_libraries(db)


@app.post("/api/libraries", response_model=schemas.LibraryResponse, status_code=201)
def create_library(data: schemas.LibraryCreate, db: Session = Depends(get_db)):
    """创建新知识库"""
    tags = [t.model_dump() for t in data.tags]
    sources = [s.model_dump() for s in data.sources]
    return crud.create_library(db, data.name, data.description, tags, sources)


@app.get("/api/libraries/{library_id}", response_model=schemas.LibraryResponse)
def get_library(library_id: str, db: Session = Depends(get_db)):
    """获取单个知识库"""
    library = crud.get_library(db, library_id)
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")
    return library


@app.put("/api/libraries/{library_id}", response_model=schemas.LibraryResponse)
def update_library(library_id: str, data: schemas.LibraryUpdate, db: Session = Depends(get_db)):
    """更新知识库"""
    tags = [t.model_dump() for t in data.tags] if data.tags is not None else None
    sources = [s.model_dump() for s in data.sources] if data.sources is not None else None
    library = crud.update_library(db, library_id, data.name, data.description, tags, sources)
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")
    return library


@app.delete("/api/libraries/{library_id}")
def delete_library(library_id: str, db: Session = Depends(get_db)):
    """删除知识库"""
    if not crud.delete_library(db, library_id):
        raise HTTPException(status_code=404, detail="Library not found")
    return {"success": True}


# ==================== 知识点 API ====================

@app.get("/api/libraries/{library_id}/points", response_model=list[schemas.PointResponse])
def list_points(library_id: str, db: Session = Depends(get_db)):
    """获取知识库中的所有知识点"""
    return crud.get_points(db, library_id)


@app.post("/api/points", response_model=schemas.PointResponse, status_code=201)
def create_point(data: schemas.PointCreate, db: Session = Depends(get_db)):
    """创建知识点"""
    return crud.create_point(
        db, data.library_id, data.title, data.content,
        data.source, data.page, data.x, data.y, data.tags
    )


@app.get("/api/points/{point_id}", response_model=schemas.PointResponse)
def get_point(point_id: str, db: Session = Depends(get_db)):
    """获取单个知识点"""
    point = crud.get_point(db, point_id)
    if not point:
        raise HTTPException(status_code=404, detail="Point not found")
    return point


@app.put("/api/points/{point_id}", response_model=schemas.PointResponse)
def update_point(point_id: str, data: schemas.PointUpdate, db: Session = Depends(get_db)):
    """更新知识点"""
    point = crud.update_point(
        db, point_id, data.title, data.content,
        data.source, data.page, data.x, data.y, data.tags
    )
    if not point:
        raise HTTPException(status_code=404, detail="Point not found")
    return point


@app.delete("/api/points/{point_id}")
def delete_point(point_id: str, db: Session = Depends(get_db)):
    """删除知识点"""
    if not crud.delete_point(db, point_id):
        raise HTTPException(status_code=404, detail="Point not found")
    return {"success": True}


# ==================== 批量操作 API ====================

@app.get("/api/libraries/{library_id}/points/count-by-tag")
def count_points_by_tag(
    library_id: str,
    tag_name: str = Query(..., alias="tagName"),
    db: Session = Depends(get_db)
):
    """统计某标签下的知识点数量"""
    count = crud.count_points_by_tag(db, library_id, tag_name)
    return {"count": count}


@app.delete("/api/libraries/{library_id}/points/by-tag")
def delete_points_by_tag(
    library_id: str,
    tag_name: str = Query(..., alias="tagName"),
    db: Session = Depends(get_db)
):
    """删除某标签下的所有知识点"""
    count = crud.delete_points_by_tag(db, library_id, tag_name)
    return {"deleted": count}


# ==================== 链接 API ====================

@app.get("/api/libraries/{library_id}/links", response_model=list[schemas.LinkResponse])
def list_links(library_id: str, db: Session = Depends(get_db)):
    """获取知识库中的所有链接"""
    return crud.get_links(db, library_id)


@app.post("/api/links", response_model=schemas.LinkResponse, status_code=201)
def create_link(data: schemas.LinkCreate, db: Session = Depends(get_db)):
    """创建链接"""
    link = crud.create_link(db, data.from_id, data.to_id, data.type)
    if not link:
        raise HTTPException(status_code=409, detail="Link already exists")
    return link


@app.delete("/api/links/{link_id}")
def delete_link(link_id: str, db: Session = Depends(get_db)):
    """删除链接"""
    if not crud.delete_link(db, link_id):
        raise HTTPException(status_code=404, detail="Link not found")
    return {"success": True}


# ==================== 版本快照 API ====================

@app.get("/api/points/{point_id}/snapshots", response_model=list[schemas.SnapshotResponse])
def list_snapshots(point_id: str, days: int = 300, db: Session = Depends(get_db)):
    """获取知识点的版本历史"""
    return crud.get_snapshots(db, point_id, days)


@app.post("/api/points/{point_id}/restore", response_model=schemas.PointResponse)
def restore_snapshot(point_id: str, data: schemas.RestoreRequest, db: Session = Depends(get_db)):
    """从快照恢复知识点"""
    point = crud.restore_snapshot(db, point_id, data.snapshot_id)
    if not point:
        raise HTTPException(status_code=404, detail="Point or snapshot not found")
    return point


# ==================== 词频统计 API ====================

@app.get("/api/libraries/{library_id}/word-frequency", response_model=schemas.WordFrequencyResponse)
def get_word_frequency(
    library_id: str,
    mode: str = Query("content", regex="^(content|tag)$"),
    db: Session = Depends(get_db)
):
    """获取词频统计"""
    data = crud.get_word_frequency(db, library_id, mode)
    return {
        "mode": mode,
        "data": [{"word": w, "count": c} for w, c in data]
    }


# ==================== 导出 API ====================

@app.get("/api/libraries/{library_id}/export")
def export_library(
    library_id: str,
    format: str = Query("json", regex="^(json|markdown|csv)$"),
    tag_filter: Optional[str] = Query(None, alias="tagFilter"),
    db: Session = Depends(get_db)
):
    """导出知识库数据"""
    library = crud.get_library(db, library_id)
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")

    points = crud.get_points(db, library_id)
    links = crud.get_links(db, library_id)

    # 标签筛选
    if tag_filter:
        tag_names = tag_filter.split(",")
        points = [p for p in points if any(t.name in tag_names for t in p.tags)]

    if format == "json":
        data = {
            "library": {
                "id": library.id,
                "name": library.name,
                "description": library.description,
            },
            "points": [
                {
                    "id": p.id,
                    "title": p.title,
                    "content": p.content,
                    "source": p.source,
                    "page": p.page,
                    "tags": [t.name for t in p.tags],
                }
                for p in points
            ],
            "links": [
                {"fromId": l.from_id, "toId": l.to_id, "type": l.type}
                for l in links
            ]
        }
        return Response(
            content=json.dumps(data, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{library.name}.json"'}
        )

    elif format == "markdown":
        lines = [f"# {library.name}\n"]
        if library.description:
            lines.append(f"{library.description}\n")
        lines.append("\n## 知识点\n")
        for p in points:
            tags = ", ".join(t.name for t in p.tags)
            lines.append(f"### {p.title}\n")
            lines.append(f"**标签**: {tags}\n")
            lines.append(f"**出处**: {p.source or '无'} (页码: {p.page or '无'})\n\n")
            lines.append(f"{p.content}\n\n---\n")

        content = "\n".join(lines)
        return Response(
            content=content,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="{library.name}.md"'}
        )

    elif format == "csv":
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "标题", "内容", "标签", "出处", "页码"])
        for p in points:
            writer.writerow([
                p.id,
                p.title,
                p.content,
                ",".join(t.name for t in p.tags),
                p.source or "",
                p.page or ""
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{library.name}.csv"'}
        )


@app.post("/api/export/batch")
def export_libraries_batch(
    data: schemas.BatchExportRequest,
    db: Session = Depends(get_db)
):
    """批量导出知识库"""
    from datetime import datetime
    
    if not data.library_ids:
        # Export all
        libraries = crud.get_libraries(db)
    else:
        # Export selected
        libraries = []
        for lid in data.library_ids:
            lib = crud.get_library(db, lid)
            if lib:
                libraries.append(lib)

    export_data = []
    for lib_summary in libraries:
        # Re-fetch full library data to ensure eager loading of relations
        full_lib = crud.get_library(db, lib_summary.id)
        if not full_lib:
            continue
            
        points = crud.get_points(db, full_lib.id)
        links = crud.get_links(db, full_lib.id)

        lib_data = {
            "meta": {
                "id": full_lib.id,
                "name": full_lib.name,
                "description": full_lib.description,
                "tags": [{"name": t.name, "color": t.color, "id": t.id} for t in full_lib.tags],
                "sources": [{"name": s.name, "id": s.id} for s in full_lib.sources],
                "created_at": full_lib.created_at.isoformat() if full_lib.created_at else None,
                "updated_at": full_lib.updated_at.isoformat() if full_lib.updated_at else None,
            },
            "points": [
                {
                    "id": p.id,
                    "title": p.title,
                    "content": p.content,
                    "source": p.source,
                    "page": p.page,
                    "tags": [t.name for t in p.tags],
                    "x": p.x,
                    "y": p.y
                }
                for p in points
            ],
            "links": [
                {"id": l.id, "fromId": l.from_id, "toId": l.to_id, "type": l.type}
                for l in links
            ]
        }
        export_data.append(lib_data)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"knowledge_export_batch_{timestamp}.json"
    
    return Response(
        content=json.dumps(export_data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


    return Response(
        content=json.dumps(export_data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.post("/api/import")
async def import_libraries_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入知识库 (JSON)"""
    content = await file.read()
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            data = [data]
        elif not isinstance(data, list):
            raise HTTPException(status_code=400, detail="Invalid JSON format: expected list or dict")
            
        count = crud.import_libraries_from_data(db, data)
        return {"success": True, "count": count}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


# ==================== 健康检查 ====================

@app.get("/health")
def health_check():
    """健康检查端点"""
    return {"status": "ok"}


# ==================== 静态文件服务（必须在所有 API 路由之后）====================
# 挂载到根路径，html=True 启用 SPA 模式自动返回 index.html
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

