import { store } from '../store.js?v=2';
import { Modal } from '../components/modal.js';
import { ColorPicker } from '../components/colorPicker.js';
import { Toast } from '../components/toast.js';

export class HomeView {
    constructor(rootElement) {
        this.root = rootElement;
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
                        <input type="file" id="import-input" accept=".json" style="display:none">
                        <button id="import-btn" class="btn btn-ghost" title="导入知识库" style="border: 1px solid var(--glass-border); padding: 10px;">
                            📥
                        </button>
                        <button id="export-all-btn" class="btn btn-ghost" title="批量导出" style="border: 1px solid var(--glass-border); padding: 10px;">
                            📤
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
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${stats.total_libraries}</div>
                        <div style="color: var(--text-300); font-size: 0.9rem;">知识库数量</div>
                    </div>
                    <div class="glass-panel" style="padding: 24px; border-radius: 16px; text-align: center; border: 1px solid var(--glass-border);">
                        <div style="font-size: 2rem; margin-bottom: 8px;">💡</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #4ECDC4;">${stats.total_points}</div>
                        <div style="color: var(--text-300); font-size: 0.9rem;">知识点总数</div>
                    </div>
                    <div class="glass-panel" style="padding: 24px; border-radius: 16px; text-align: center; border: 1px solid var(--glass-border);">
                        <div style="font-size: 2rem; margin-bottom: 8px;">🔗</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #FF6B6B;">${stats.total_links}</div>
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

        grid.innerHTML = libraries.map(lib => `
            <div class="card fade-in" data-id="${lib.id}" style="cursor: pointer;">
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
            </div>
        `).join('');

        // Bind card clicks
        grid.querySelectorAll('.card').forEach(card => {
            card.onclick = () => {
                const id = card.dataset.id;
                // console.log('Navigate to library', id);
                window.app.navigateTo('library', { id });
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

    bindEvents() {
        console.log('HomeView.bindEvents called');
        this.root.querySelector('#create-lib-btn').onclick = () => this.showCreateModal();
        this.root.querySelector('#export-all-btn').onclick = () => {
            console.log('Export button clicked');
            this.showExportModal();
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

            // 1. Filter local library cards
            this.filterLibraries(query);

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
            }
        });
        modal.show();
    }

    async handleDelete(id) {
        if (confirm('确定要删除这个知识库吗？此操作无法撤销。')) {
            await store.deleteLibrary(id);
            this.loadLibraries();
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

    destroy() {
        // Cleanup if needed
    }
}
