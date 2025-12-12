import { store } from '../store.js';
import { Modal } from '../components/modal.js';
import { ColorPicker } from '../components/colorPicker.js';

export class HomeView {
    constructor(rootElement) {
        this.root = rootElement;
    }

    async render() {
        this.root.innerHTML = `
            <div class="container" style="padding: 40px; max-width: 1200px; margin: 0 auto;">
                <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px;">
                    <div>
                        <h1 style="margin-bottom: 8px;">📚 知识图谱库</h1>
                        <p>管理您的知识网络</p>
                    </div>
                    <button id="create-lib-btn" class="btn btn-primary">
                        <span style="font-size: 1.2rem;">+</span> 新建知识库
                    </button>
                </header>

                <div id="library-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;">
                    <!-- Libraries injected here -->
                    <div class="loader">加载中...</div>
                </div>
            </div>
        `;

        await this.loadLibraries();
        this.bindEvents();
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
                    <span>📊 0 知识点</span> <!-- TODO: Real counts -->
                    <span>🔗 0 链接</span>
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
        this.root.querySelector('#create-lib-btn').onclick = () => this.showCreateModal();
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
