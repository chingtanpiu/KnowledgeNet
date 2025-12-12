/**
 * Store.js
 * HTTP API wrapper for Backend communication.
 * All methods return Promises for async operations.
 */

// 使用相对路径，前端由后端静态文件服务提供
const API_BASE = '/api';

// Helper: Fetch with error handling
async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

class Store {
    constructor() {
        // No local cache needed, all data from server
    }

    // ================= Libraries =================

    async getLibraries() {
        const libraries = await apiFetch(`${API_BASE}/libraries`);
        // 将后端的 description 映射为前端的 notes
        return libraries.map(lib => ({
            ...lib,
            notes: lib.description
        }));
    }

    async getLibrary(id) {
        const library = await apiFetch(`${API_BASE}/libraries/${id}`);
        // 将后端的 description 映射为前端的 notes
        return {
            ...library,
            notes: library.description
        };
    }

    async createLibrary(libData) {
        return apiFetch(`${API_BASE}/libraries`, {
            method: 'POST',
            body: JSON.stringify({
                name: libData.name,
                description: libData.notes || libData.description,  // 兼容前端 notes 字段
                tags: libData.tags || [],
                sources: libData.sources || [],
            }),
        });
    }

    async updateLibrary(id, updates) {
        return apiFetch(`${API_BASE}/libraries/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: updates.name,
                description: updates.notes || updates.description,  // 兼容前端 notes 字段
                tags: updates.tags,
                sources: updates.sources,
            }),
        });
    }

    async deleteLibrary(id) {
        await apiFetch(`${API_BASE}/libraries/${id}`, {
            method: 'DELETE',
        });
        return true;
    }

    // ================= Points =================

    async getPoints(libraryId) {
        return apiFetch(`${API_BASE}/libraries/${libraryId}/points`);
    }

    async createPoint(pointData) {
        // Convert tags array to tag names
        const tagNames = (pointData.tags || []).map(t =>
            typeof t === 'string' ? t : t.name
        );

        return apiFetch(`${API_BASE}/points`, {
            method: 'POST',
            body: JSON.stringify({
                library_id: pointData.libraryId,
                title: pointData.title,
                content: pointData.content,
                source: pointData.source,
                page: pointData.page,
                x: pointData.x || 0,
                y: pointData.y || 0,
                tags: tagNames,
            }),
        });
    }

    async updatePoint(id, updates) {
        // Convert tags array to tag names if present
        let tagNames = undefined;
        if (updates.tags !== undefined) {
            tagNames = updates.tags.map(t =>
                typeof t === 'string' ? t : t.name
            );
        }

        return apiFetch(`${API_BASE}/points/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: updates.title,
                content: updates.content,
                source: updates.source,
                page: updates.page,
                x: updates.x,
                y: updates.y,
                tags: tagNames,
            }),
        });
    }

    async deletePoint(id) {
        await apiFetch(`${API_BASE}/points/${id}`, {
            method: 'DELETE',
        });
        return true;
    }

    // ================= Links =================

    async getLinks(libraryId) {
        return apiFetch(`${API_BASE}/libraries/${libraryId}/links`);
    }

    async createLink(linkData) {
        try {
            return await apiFetch(`${API_BASE}/links`, {
                method: 'POST',
                body: JSON.stringify({
                    fromId: linkData.fromId,
                    toId: linkData.toId,
                    type: linkData.type || 'related',
                }),
            });
        } catch (error) {
            // Link already exists
            if (error.message.includes('already exists')) {
                return null;
            }
            throw error;
        }
    }

    async deleteLink(id) {
        await apiFetch(`${API_BASE}/links/${id}`, {
            method: 'DELETE',
        });
        return true;
    }

    // ================= Batch Operations =================

    async countPointsByTag(libraryId, tagName) {
        const result = await apiFetch(
            `${API_BASE}/libraries/${libraryId}/points/count-by-tag?tagName=${encodeURIComponent(tagName)}`
        );
        return result.count;
    }

    async deletePointsByTag(libraryId, tagName) {
        const result = await apiFetch(
            `${API_BASE}/libraries/${libraryId}/points/by-tag?tagName=${encodeURIComponent(tagName)}`,
            { method: 'DELETE' }
        );
        return result.deleted;
    }

    // ================= Snapshots (Version History) =================

    async getSnapshots(pointId, days = 300) {
        return apiFetch(`${API_BASE}/points/${pointId}/snapshots?days=${days}`);
    }

    async restoreSnapshot(pointId, snapshotId) {
        return apiFetch(`${API_BASE}/points/${pointId}/restore`, {
            method: 'POST',
            body: JSON.stringify({ snapshot_id: snapshotId }),
        });
    }

    // ================= Word Frequency =================

    async getWordFrequency(libraryId, mode = 'content') {
        return apiFetch(`${API_BASE}/libraries/${libraryId}/word-frequency?mode=${mode}`);
    }

    // ================= Export =================

    async exportLibrary(libraryId, format = 'json', tagFilter = null) {
        let url = `${API_BASE}/libraries/${libraryId}/export?format=${format}`;
        if (tagFilter) {
            url += `&tagFilter=${encodeURIComponent(tagFilter.join(','))}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Export failed');
        }

        const blob = await response.blob();
        const filename = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
            || `export.${format}`;

        // Trigger download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);

        return true;
    }
}

export const store = new Store();
