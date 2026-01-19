import { store } from '../store.js?v=3';
import { Modal } from '../components/modal.js';
import { ColorPicker } from '../components/colorPicker.js';
import { Toast } from '../components/toast.js';
import { undoManager } from '../undoManager.js';

export class HomeView {
    constructor(rootElement) {
        this.root = rootElement;
        this.selectedLibraryIds = new Set();

        // 绑定键盘事件
        this.handleKeyDown = this.handleKeyDown.bind(this);
        window.addEventListener('keydown', this.handleKeyDown);
        console.log('[HomeView] Constructor: keyboard event listener added');
    }

    async render() {
        try {
            const stats = await store.getGlobalStats().catch(err => {
                console.warn('Failed to fetch stats:', err);
                return { total_libraries: 0, total_points: 0, total_links: 0 };
            });

            this.root.innerHTML = `
                <div class="container" style="padding: 40px; max-width: 1200px; margin: 0 auto;">
                    <header style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 30px;">
                    <div>
                        <h1 style="margin-bottom: 8px;">📚 知识图谱库</h1>
                        <p style="color: var(--text-300);">管理您的知识网络，连接智慧的点滴</p>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="position: relative;">
                             <input type="text" id="global-search-input" placeholder="🔍 搜索库或知识点..." 
                                style="background: var(--bg-dark-800); border: 1px solid var(--glass-border); color: #fff; padding: 10px 16px; border-radius: 8px; width: 260px; outline: none; transition: all 0.3s;">
                             <div id="global-search-results" class="glass-panel" style="position: absolute; top: calc(100% + 10px); right: 0; width: 400px; max-height: 500px; overflow-y: auto; z-index: 100; display: none; padding: 16px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                                <!-- Results here -->
                             </div>
                        </div>
                        <div id="batch-actions" style="display: none; align-items: center; gap: 12px; background: var(--bg-dark-700); padding: 8px 16px; border-radius: 8px; border: 1px solid var(--primary-color); margin-right: 12px;">
                            <span id="selected-count" style="font-weight: bold; color: var(--primary-color);">已选 0 项</span>
                            <button id="batch-delete-btn" class="btn" style="background: var(--danger-color); color: white; padding: 6px 12px; font-size: 0.9rem;">🗑️ 批量删除</button>
                            <button id="cancel-selection-btn" class="btn btn-ghost" style="padding: 6px 12px; font-size: 0.9rem;">取消</button>
                        </div>
                        <input type="file" id="import-input" accept=".json" style="display:none">
                        <button id="import-btn" class="btn btn-ghost" title="导入知识库" style="border: 1px solid var(--glass-border); padding: 8px 16px; display: flex; align-items: center; gap: 8px;">
                            <span>📥</span> <span>导入</span>
                        </button>
                        <button id="export-all-btn" class="btn btn-ghost" title="批量导出" style="border: 1px solid var(--glass-border); padding: 8px 16px; display: flex; align-items: center; gap: 8px;">
                            <span>📤</span> <span>导出</span>
                        </button>
                        <button id="create-lib-btn" class="btn btn-primary" style="padding: 10px 20px;">
                            <span style="font-size: 1.2rem; line-height: 1;">+</span> 新建
                        </button>
                    </div>
                </header>

                <!-- Dashboard Stats -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 40px;">
                    <div class="glass-panel" style="padding: 24px; border-radius: 16px; text-align: center; border: 1px solid var(--glass-border);">
                        <div style="font-size: 2rem; margin-bottom: 8px;">📁</div>
                        <div id="stat-total-libraries" style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${stats.total_libraries}</div>
                        <div style="color: var(--text-300); font-size: 0.9rem;">知识库数量</div>
                    </div>
                    <div class="glass-panel" style="padding: 24px; border-radius: 16px; text-align: center; border: 1px solid var(--glass-border);">
                        <div style="font-size: 2rem; margin-bottom: 8px;">💡</div>
                        <div id="stat-total-points" style="font-size: 1.5rem; font-weight: 700; color: #4ECDC4;">${stats.total_points}</div>
                        <div style="color: var(--text-300); font-size: 0.9rem;">知识点总数</div>
                    </div>
                    <div class="glass-panel" style="padding: 24px; border-radius: 16px; text-align: center; border: 1px solid var(--glass-border);">
                        <div style="font-size: 2rem; margin-bottom: 8px;">🔗</div>
                        <div id="stat-total-links" style="font-size: 1.5rem; font-weight: 700; color: #FF6B6B;">${stats.total_links}</div>
                        <div style="color: var(--text-300); font-size: 0.9rem;">关联总数</div>
                    </div>
                </div>

                <div id="library-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;">
                    <!-- Libraries injected here -->
                    <div class="loader">加载中...</div>
                </div>
            </div>
        `;

            await this.loadLibraries();
            this.bindEvents();
        } catch (e) {
            console.error('HomeView render failed:', e);
            this.root.innerHTML = `
                <div class="flex-center" style="height: 100vh; flex-direction: column;">
                    <div style="color: var(--danger-color); font-size: 1.2rem; margin-bottom: 16px;">⚠️ 系统初始化失败</div>
                    <div style="color: var(--text-300); margin-bottom: 24px;">${e.message}</div>
                    <button class="btn btn-primary" onclick="window.location.reload()">重新加载</button>
                </div>
            `;
        }
    }

    async loadLibraries() {
        const libraries = await store.getLibraries();
        const grid = this.root.querySelector('#library-grid');

        if (libraries.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px; background: var(--bg-dark-800); border-radius: 16px; border: 2px dashed var(--bg-dark-600);">
                    <h3 style="margin-bottom: 12px; color: var(--text-200);">还没有知识库</h3>
                    <p style="margin-bottom: 24px;">创建一个新的知识库来开始构建您的知识网络</p>
                    <button class="btn btn-primary" onclick="document.getElementById('create-lib-btn').click()">立即创建</button>
                </div>
            `;
            return;
        }

        grid.innerHTML = libraries.map(lib => {
            const isSelected = this.selectedLibraryIds.has(lib.id);
            const borderStyle = isSelected ? '2px solid var(--primary-color)' : '1px solid var(--glass-border)';
            const bgStyle = isSelected ? 'background: rgba(var(--primary-hue), 70%, 60%, 0.1);' : '';

            return `
            <div class="card fade-in" data-id="${lib.id}" style="cursor: pointer; border: ${borderStyle}; ${bgStyle} transition: all 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <h3 style="color: var(--primary-color);">${lib.name}</h3>
                    <div class="actions" onclick="event.stopPropagation()">
                        <button class="btn btn-ghost" style="padding: 4px;" title="配置" data-action="edit">⚙️</button>
                        <button class="btn btn-ghost" style="padding: 4px; color: var(--danger-color);" title="删除" data-action="delete">🗑️</button>
                    </div>
                </div>
                <p style="margin-bottom: 20px; font-size: 0.9rem; height: 3em; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${lib.notes || '无备注'}
                </p>
                <div style="margin-bottom: 16px; display: flex; flex-wrap: wrap;">
                     ${(lib.tags || []).slice(0, 3).map(tag => `<span class="tag" style="background-color: ${tag.color};">${tag.name}</span>`).join('')}
                     ${(lib.tags || []).length > 3 ? `<span class="tag" style="background-color: var(--bg-dark-600); color: var(--text-200);">+${lib.tags.length - 3}</span>` : ''}
                </div>
                <div style="display: flex; gap: 12px; font-size: 0.85rem; color: var(--text-300); border-top: 1px solid var(--glass-border); padding-top: 16px;">
                    <span>📊 ${lib.point_count || 0} 知识点</span>
                    <span>🔗 ${lib.link_count || 0} 链接</span>
                </div>
                ${isSelected ? '<div style="position: absolute; top: 10px; right: 10px; background: var(--primary-color); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px;">✓</div>' : ''}
            </div>
        `}).join('');

        // Bind card clicks
        grid.querySelectorAll('.card').forEach(card => {
            card.onclick = (e) => {
                const id = card.dataset.id;

                if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    // Multi-select toggle
                    if (this.selectedLibraryIds.has(id)) {
                        this.selectedLibraryIds.delete(id);
                    } else {
                        this.selectedLibraryIds.add(id);
                    }
                    this.updateSelectionUI();
                    this.renderLibraries(this.libraries); // Re-render to update UI
                } else {
                    if (this.selectedLibraryIds.size > 0) {
                        // If in selection mode, clicking without modifier clears selection
                        this.selectedLibraryIds.clear();
                        this.updateSelectionUI();
                        this.renderLibraries(this.libraries);
                    } else {
                        // Regular navigation
                        window.app.navigateTo('library', { id });
                    }
                }
            };

            // Bind actions
            card.querySelectorAll('[data-action]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const id = card.dataset.id;
                    if (action === 'delete') this.handleDelete(id);
                    if (action === 'edit') this.handleEdit(id);
                };
            });
        });
    }

    async refreshStats() {
        try {
            const stats = await store.getGlobalStats();

            // Update the three stat cards
            // Update stats using IDs
            const statLib = this.root.querySelector('#stat-total-libraries');
            const statPoints = this.root.querySelector('#stat-total-points');
            const statLinks = this.root.querySelector('#stat-total-links');

            if (statLib) statLib.textContent = stats.total_libraries;
            if (statPoints) statPoints.textContent = stats.total_points;
            if (statLinks) statLinks.textContent = stats.total_links;
        } catch (err) {
            console.error('Failed to refresh stats:', err);
        }
    }

    updateSelectionUI() {
        const batchActions = this.root.querySelector('#batch-actions');
        const countSpan = this.root.querySelector('#selected-count');
        const count = this.selectedLibraryIds.size;

        if (count > 0) {
            batchActions.style.display = 'flex';
            countSpan.textContent = `已选 ${count} 项`;
        } else {
            batchActions.style.display = 'none';
        }
    }

    bindEvents() {
        console.log('HomeView.bindEvents called');
        this.root.querySelector('#create-lib-btn').onclick = () => this.showCreateModal();
        this.root.querySelector('#export-all-btn').onclick = () => {
            console.log('Export button clicked');
            this.showExportModal();
        };

        // Batch Action Events
        this.root.querySelector('#cancel-selection-btn').onclick = () => {
            this.selectedLibraryIds.clear();
            this.updateSelectionUI();
            this.renderLibraries(this.libraries);
        };

        this.root.querySelector('#batch-delete-btn').onclick = () => {
            this.handleBatchDelete();
        };

        // Import logic
        this.root.querySelector('#import-btn').onclick = () => {
            this.root.querySelector('#import-input').click();
        };
        this.root.querySelector('#import-input').onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                Toast.show('正在导入...', 'info');
                const result = await store.importLibrary(file);
                Toast.show(`成功导入 ${result.count} 个知识库`, 'success');
                this.loadLibraries();
            } catch (err) {
                console.error(err);
                Toast.show('导入失败: ' + err.message, 'error');
            }
            e.target.value = ''; // Reset input
        };

        // Global Search
        const searchInput = this.root.querySelector('#global-search-input');
        const resultsPanel = this.root.querySelector('#global-search-results');
        let searchTimeout;

        searchInput.oninput = (e) => {
            const query = e.target.value.trim();

            // 1. Filter local library cards - DISABLED
            // this.filterLibraries(query); // Don't hide libraries when searching globally

            // 2. Clear previous results
            resultsPanel.style.display = 'none';
            clearTimeout(searchTimeout);

            if (query.length < 1) return;

            // 3. Debounce global search
            searchTimeout = setTimeout(async () => {
                try {
                    const results = await store.searchGlobal(query);
                    this.showSearchResults(results, query);
                } catch (err) {
                    console.error('Search failed', err);
                }
            }, 300);
        };

        // UI Interactions for search
        searchInput.onfocus = () => {
            if (resultsPanel.innerHTML.trim() !== '' && searchInput.value.trim().length >= 1) {
                resultsPanel.style.display = 'block';
            }
        };

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsPanel.contains(e.target)) {
                resultsPanel.style.display = 'none';
            }
        });
    }

    filterLibraries(query) {
        const lowerQuery = query.toLowerCase();
        const cards = this.root.querySelectorAll('#library-grid .card');
        cards.forEach(card => {
            const name = card.querySelector('h3').textContent.toLowerCase();
            const notes = card.querySelector('p').textContent.toLowerCase();
            if (name.includes(lowerQuery) || notes.includes(lowerQuery)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    showSearchResults(results, query) {
        const resultsPanel = this.root.querySelector('#global-search-results');

        if (results.libraries.length === 0 && results.points.length === 0) {
            resultsPanel.innerHTML = `<div style="color: var(--text-300); text-align: center; padding: 10px;">未找到匹配内容</div>`;
        } else {
            let html = '';

            if (results.libraries.length > 0) {
                html += `<div style="margin-bottom: 20px;">
                            <div style="font-size: 0.8rem; font-weight: bold; color: var(--primary-color); margin-bottom: 10px; border-bottom: 1px solid var(--glass-border); padding-bottom: 4px;">📂 知识库 (${results.libraries.length})</div>
                            ${results.libraries.map(lib => `
                                <div class="search-result-item" style="padding: 8px; cursor: pointer; border-radius: 6px; transition: background 0.2s;" onclick="window.app.navigateTo('library', {id: '${lib.id}'})">
                                    <div style="color: #fff; font-weight: 600;">${lib.name}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-300);">${lib.description || '无描述'}</div>
                                </div>
                            `).join('')}
                         </div>`;
            }

            if (results.points.length > 0) {
                html += `<div>
                            <div style="font-size: 0.8rem; font-weight: bold; color: #4ECDC4; margin-bottom: 10px; border-bottom: 1px solid var(--glass-border); padding-bottom: 4px;">💡 知识点 (${results.points.length})</div>
                            ${results.points.map(p => `
                                <div class="search-result-item" style="padding: 8px; cursor: pointer; border-radius: 6px; transition: background 0.2s;" onclick="window.app.navigateTo('library', {id: '${p.library_id}', focus: '${p.id}'})">
                                    <div style="color: #fff; font-weight: 600;">${p.title}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-300);">所属库: ${p.library_name}</div>
                                </div>
                            `).join('')}
                         </div>`;
            }

            resultsPanel.innerHTML = html;

            // Add hover styles
            resultsPanel.querySelectorAll('.search-result-item').forEach(item => {
                item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.05)';
                item.onmouseleave = () => item.style.background = 'transparent';
            });
        }

        resultsPanel.style.display = 'block';
    }

    async showExportModal() {
        console.log('showExportModal started');
        try {
            const libraries = await store.getLibraries();
            console.log('Libraries fetched for export:', libraries.length);

            const content = `
                <div style="margin-bottom: 20px;">
                <p style="margin-bottom: 12px; color: var(--text-200);">选择要导出的知识库（JSON格式）：</p>
                <div style="background: var(--bg-dark-900); border: 1px solid var(--glass-border); border-radius: 8px; max-height: 300px; overflow-y: auto; padding: 12px;">
                    <label style="display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--glass-border); margin-bottom: 8px; font-weight: 600;">
                        <input type="checkbox" id="export-select-all"> 全选 / 取消全选
                    </label>
                    <div id="export-list" style="display: flex; flex-direction: column; gap: 8px;">
                        ${libraries.map(lib => `
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" class="lib-check" value="${lib.id}">
                                <span>${lib.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

            const modal = new Modal({
                title: '批量导出知识库',
                content: content,
                onConfirm: async () => {
                    const checkboxes = document.querySelectorAll('.lib-check');
                    const selectedIds = Array.from(checkboxes)
                        .filter(cb => cb.checked)
                        .map(cb => cb.value);

                    if (selectedIds.length === 0) {
                        Toast.show('请至少选择一个知识库', 'error');
                        return;
                    }

                    Toast.show('正在准备导出...', 'info');
                    try {
                        await store.batchExport(selectedIds);
                        Toast.show('导出成功', 'success');
                        modal.hide();
                    } catch (e) {
                        Toast.show('导出失败: ' + e.message, 'error');
                    }
                }
            });

            modal.show();

            // Bind Select All
            // Wait for modal DOM insertion
            setTimeout(() => {
                const selectAll = document.getElementById('export-select-all');
                const libChecks = document.querySelectorAll('.lib-check');
                if (selectAll) {
                    selectAll.onchange = (e) => {
                        libChecks.forEach(cb => cb.checked = e.target.checked);
                    };
                }
            }, 100);
        } catch (e) {
            console.error(e);
            alert('Export failed: ' + e.message);
        }
    }

    showCreateModal() {
        const formHtml = `
    <div class="form-group">
                <label class="form-label">知识库名称 *</label>
                <input type="text" id="lib-name" class="form-input" placeholder="例如：法律知识网络库">
            </div>
            <div class="form-group">
                <label class="form-label">出处配置 (每行一个) *</label>
                <textarea id="lib-sources" class="form-textarea" placeholder="《刑法学》&#10;《民法典解读》"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">备注 *</label>
                <textarea id="lib-notes" class="form-textarea" placeholder="简要描述该知识库的内容..."></textarea>
            </div>
`;

        const modal = new Modal({
            title: '新建知识点网络库',
            content: formHtml,
            onConfirm: async () => {
                const name = document.getElementById('lib-name').value;
                const sourcesRaw = document.getElementById('lib-sources').value;
                const notes = document.getElementById('lib-notes').value;

                if (!name || !sourcesRaw || !notes) {
                    alert('请填写所有必填项');
                    return;
                }

                const sources = sourcesRaw.split('\n').filter(s => s.trim()).map(s => ({ name: s.trim() }));

                await store.createLibrary({
                    name,
                    notes,
                    sources,
                    tags: [] // Initial empty tags
                });

                modal.hide();
                this.loadLibraries(); // Refresh
                await this.refreshStats();
            }
        });
        modal.show();
    }

    async handleDelete(id) {
        console.log('[HomeView] handleDelete called for library:', id);

        if (!confirm('确定要删除这个知识库吗？\n警告：所有相关的知识点和链接都将被永久删除！')) {
            return;
        }

        try {
            // Backup data for undo
            Toast.show('正在准备删除...', 'info');
            const backupData = await store.getLibraryExportData(id);
            console.log('[HomeView] Backup data retrieved:', backupData.meta.name);

            await undoManager.execute({
                description: `删除知识库 "${backupData.meta.name}"`,
                execute: async () => {
                    const success = await store.deleteLibrary(id);
                    if (success) {
                        await this.loadLibraries();
                        await this.refreshStats();
                        return true;
                    }
                    return false;
                },
                undo: async () => {
                    console.log('Undoing library deletion, restoring:', backupData.meta.name);
                    const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
                    const file = new File([blob], `${backupData.meta.name}.json`, { type: 'application/json' });
                    const result = await store.importLibrary(file);
                    console.log('Import result:', result);
                    await this.loadLibraries();
                    await this.refreshStats();
                }
            });

            Toast.show('知识库已删除 (Ctrl+Z 撤销)', 'success');
        } catch (err) {
            console.error('Delete failed:', err);
            Toast.show('删除失败: ' + err.message, 'error');
        }
    }

    async handleBatchDelete() {
        const count = this.selectedLibraryIds.size;
        if (count === 0) return;

        // No confirmation dialog as requested

        try {
            Toast.show(`正在准备删除 ${count} 个知识库...`, 'info');
            const backups = [];

            // 1. Backup all data first
            for (const id of this.selectedLibraryIds) {
                try {
                    const data = await store.getLibraryExportData(id);
                    backups.push({ id, data });
                } catch (e) {
                    console.error(`Backup failed for ${id}`, e);
                    Toast.show('备份失败，取消删除', 'error');
                    return;
                }
            }

            await undoManager.execute({
                description: `批量删除 ${count} 个知识库`,
                execute: async () => {
                    let successCount = 0;
                    for (const { id } of backups) {
                        const success = await store.deleteLibrary(id);
                        if (success) successCount++;
                    }

                    if (successCount > 0) {
                        this.selectedLibraryIds.clear();
                        this.updateSelectionUI();
                        await this.loadLibraries();
                        await this.refreshStats();
                        return true;
                    }
                    return false;
                },
                undo: async () => {
                    Toast.show('正在恢复知识库...', 'info');
                    for (const { data } of backups) {
                        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                        const file = new File([blob], `${data.meta.name}.json`, { type: 'application/json' });
                        await store.importLibrary(file);
                    }
                    await this.loadLibraries();
                    await this.refreshStats();
                    Toast.show('知识库已恢复', 'success');
                }
            });

            Toast.show(`已删除 ${backups.length} 个知识库 (Ctrl+Z 撤销)`, 'success');
        } catch (err) {
            console.error('Batch delete failed:', err);
            Toast.show('批量删除操作异常: ' + err.message, 'error');
        }
    }

    async handleEdit(id) {
        const library = await store.getLibrary(id);
        if (!library) return;

        // Clone tags to avoid mutating until save
        let currentTags = JSON.parse(JSON.stringify(library.tags || []));

        const buildForm = () => `
            <div style="max-height: 60vh; overflow-y: auto; padding-right: 8px;">
                <div class="form-group">
                    <label class="form-label">知识库名称</label>
                    <input type="text" id="edit-lib-name" class="form-input" value="${library.name}">
                </div>
                
                <div class="form-group">
                    <label class="form-label">备注</label>
                    <textarea id="edit-lib-notes" class="form-textarea">${library.notes || ''}</textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">出处列表 (每行一个)</label>
                    <textarea id="edit-lib-sources" class="form-textarea" style="min-height: 80px;">${(library.sources || []).map(s => s.name).join('\n')}</textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">标签配置</label>
                    <div style="border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 12px; background: var(--bg-dark-900);">
                        <div id="tag-list" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
                            ${currentTags.map((tag, idx) => `
                                <div class="tag" style="background-color: ${tag.color}; padding-right: 4px;">
                                    ${tag.name}
                                    <span class="remove-tag-btn" data-idx="${idx}" style="cursor: pointer; margin-left: 6px; opacity: 0.7;">&times;</span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div style="border-top: 1px solid var(--glass-border); padding-top: 12px;">
                            <label class="form-label" style="font-size: 0.8rem;">添加新标签</label>
                            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                                <input type="text" id="new-tag-name" class="form-input" placeholder="标签名称" style="flex: 1;">
                                <button id="add-tag-btn" class="btn btn-ghost" style="border: 1px solid var(--glass-border);">添加</button>
                            </div>
                            <div id="color-picker-container"></div>
                        </div>
                    </div>
                </div>
            </div>
    `;

        const modal = new Modal({
            title: '编辑知识库配置',
            content: buildForm(),
            onConfirm: async () => {
                const name = document.getElementById('edit-lib-name').value;
                const notes = document.getElementById('edit-lib-notes').value;
                const sourcesRaw = document.getElementById('edit-lib-sources').value;
                const sources = sourcesRaw.split('\n').filter(s => s.trim()).map(s => ({ name: s.trim() }));

                await store.updateLibrary(id, {
                    name,
                    notes,
                    sources,
                    tags: currentTags
                });

                modal.hide();
                this.loadLibraries();
            }
        });

        modal.show();

        // Initialize Logic within Modal
        let selectedColor = null;

        const refreshTags = () => {
            const list = document.getElementById('tag-list');
            list.innerHTML = currentTags.map((tag, idx) => `
                <div class="tag" style="background-color: ${tag.color}; padding-right: 4px;">
                    ${tag.name}
                    <span class="remove-tag-btn" data-idx="${idx}" style="cursor: pointer; margin-left: 6px; opacity: 0.7;">&times;</span>
                </div>
            `).join('');

            // Rebind delete
            list.querySelectorAll('.remove-tag-btn').forEach(btn => {
                btn.onclick = async () => {
                    const idx = parseInt(btn.dataset.idx);
                    const tagToRemove = currentTags[idx];

                    const count = await store.countPointsByTag(id, tagToRemove.name); // Check impact

                    if (confirm(`注意：删除标签 "${tagToRemove.name}" 将同时永久删除属于该标签的 ${count} 个知识点！\n\n确定要继续吗？`)) {
                        await store.deletePointsByTag(id, tagToRemove.name); // Execute Cascade Delete

                        currentTags.splice(idx, 1);
                        await store.updateLibrary(id, { tags: currentTags }); // Save Config changes

                        refreshTags();
                        refreshPicker();
                    }
                };
            });
        };

        const refreshPicker = () => {
            const pickerContainer = document.getElementById('color-picker-container');
            pickerContainer.innerHTML = '';
            const usedColors = currentTags.map(t => t.color);
            new ColorPicker({
                container: pickerContainer,
                usedColors: usedColors,
                onSelect: (color) => {
                    selectedColor = color;
                }
            }).render();
        };

        refreshPicker();
        refreshTags(); // Bind initial deletes

        document.getElementById('add-tag-btn').onclick = () => {
            const nameInput = document.getElementById('new-tag-name');
            const name = nameInput.value.trim();
            if (!name) {
                alert('请输入标签名称');
                return;
            }
            if (!selectedColor) {
                alert('请选择一个背景颜色');
                return;
            }
            if (currentTags.some(t => t.name === name)) {
                alert('标签名称已存在');
                return;
            }

            currentTags.push({ name, color: selectedColor, id: Date.now().toString() });
            nameInput.value = '';
            selectedColor = null;
            refreshTags();
            refreshPicker();
        };
    }

    async handleKeyDown(e) {
        console.log('[HomeView] handleKeyDown called:', e.key, 'Ctrl:', e.ctrlKey, 'Shift:', e.shiftKey);

        // Ctrl+Z 撤销
        if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
            console.log('[HomeView] Ctrl+Z detected');
            e.preventDefault();
            if (undoManager.canUndo()) {
                console.log('[HomeView] Executing undo...');
                try {
                    const action = await undoManager.undo();
                    if (action) {
                        Toast.show(`已撤销: ${action.description}`, 'info');
                    }
                } catch (err) {
                    console.error('Undo failed:', err);
                    Toast.show('撤销失败: ' + err.message, 'error');
                }
            } else {
                console.log('[HomeView] No actions to undo');
                Toast.show('没有可撤销的操作', 'info');
            }
        }

        // Ctrl+Shift+Z 恢复
        if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
            e.preventDefault();
            if (undoManager.canRedo()) {
                try {
                    const action = await undoManager.redo();
                    if (action) {
                        Toast.show(`已恢复: ${action.description}`, 'info');
                    }
                } catch (err) {
                    console.error('Redo failed:', err);
                    Toast.show('恢复失败: ' + err.message, 'error');
                }
            } else {
                Toast.show('没有可恢复的操作', 'info');
            }
        }
    }

    destroy() {
        // 清理键盘事件监听器
        window.removeEventListener('keydown', this.handleKeyDown);
    }
}
