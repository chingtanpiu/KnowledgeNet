import { store } from '../store.js';
import { ContextMenu } from '../components/contextMenu.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { undoManager } from '../undoManager.js';

export class LibraryView {
    constructor(rootElement, params) {
        this.root = rootElement;
        this.libraryId = params.id;
        this.focusPointId = params.focus; // 记录需要聚焦的节点 ID
        this.library = null;
        this.network = null;
        this.contextMenu = new ContextMenu();

        // 绑定键盘事件
        this.handleKeyDown = this.handleKeyDown.bind(this);
        window.addEventListener('keydown', this.handleKeyDown);
    }

    async render() {
        this.library = await store.getLibrary(this.libraryId);

        if (!this.library) {
            this.root.innerHTML = `<div class="container flex-center"><h1>未找到该知识库</h1><button onclick="window.app.navigateTo('home')" class="btn btn-primary">返回首页</button></div>`;
            return;
        }

        this.root.innerHTML = `
            <div style="position: relative; width: 100vw; height: 100vh; overflow: hidden; background: var(--bg-dark-900);">
                <canvas id="network-canvas" style="display: block; width: 100%; height: 100%; cursor: grab;"></canvas>

                <div class="glass-panel" style="position: absolute; top: 0; left: 0; right: 0; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 10;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <button class="btn btn-ghost" onclick="window.app.navigateTo('home')">← 返回</button>
                        <h2 style="font-size: 1.25rem;">${this.library.name}</h2>
                    </div>
                </div>
                <!-- Toolbar -->
                <div style="position: absolute; top: 20px; right: 20px; display: flex; gap: 12px; z-index: 10;">
                    <div style="position: relative;">
                        <input type="text" id="search-input" placeholder="🔍 搜索知识点..." 
                            style="background: rgba(30, 30, 46, 0.8); border: 1px solid var(--glass-border); color: #fff; padding: 8px 12px; border-radius: 6px; backdrop-filter: blur(10px); width: 200px; transition: width 0.3s; outline: none;">
                    </div>
                    <input type="file" id="import-library-input" accept=".json" style="display:none">
                    <button id="import-library-btn" class="btn btn-ghost" style="background: rgba(30,30,46,0.8); backdrop-filter: blur(10px); padding: 8px 16px; display: flex; align-items: center; gap: 6px;" title="导入知识库">
                        <span>📥</span> <span>导入</span>
                    </button>
                    <button id="export-btn" class="btn btn-ghost" style="background: rgba(30,30,46,0.8); backdrop-filter: blur(10px); padding: 8px 16px; display: flex; align-items: center; gap: 6px;" title="导出">
                        <span>📤</span> <span>导出</span>
                    </button>
                    <button id="stats-btn" class="btn btn-ghost" style="background: rgba(30,30,46,0.8); backdrop-filter: blur(10px); padding: 8px 16px; display: flex; align-items: center; gap: 6px;" title="统计">
                        <span>📊</span> <span>统计</span>
                    </button>
                    <button id="close-btn" class="btn btn-ghost" style="background: rgba(30,30,46,0.8); backdrop-filter: blur(10px);" title="返回" onclick="window.app.navigateTo('home')">✖️</button>
                </div>

                <div class="glass-panel" style="position: absolute; top: 70px; left: 24px; padding: 12px; border-radius: 8px; z-index: 10; width: 220px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 0.9rem; color: var(--text-200); font-weight: 600;">标签筛选</span>
                        <div class="logic-switch" style="display: flex; background: var(--bg-dark-800); border-radius: 12px; padding: 2px;">
                            <button class="filter-logic-btn active" data-logic="OR" style="font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; border: none; background: var(--primary-color); color: white; cursor: pointer; transition: all 0.2s;">(OR)</button>
                            <button class="filter-logic-btn" data-logic="AND" style="font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; border: none; background: transparent; color: var(--text-300); cursor: pointer; transition: all 0.2s;">(AND)</button>
                        </div>
                    </div>
                    <div id="tag-filter-container" style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 300px; overflow-y: auto;">
                        <label class="tag-check-label" style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--bg-dark-800); border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid var(--glass-border);">
                            <input type="checkbox" value="all" checked> 全部
                        </label>
                        ${(this.library.tags || []).map(t => `
                            <label class="tag-check-label" style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--bg-dark-800); border-radius: 12px; font-size: 0.8rem; cursor: pointer; border: 1px solid var(--glass-border);">
                                <input type="checkbox" value="${t.id}"> 
                                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${t.color};"></span>
                                ${t.name}
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div style="position: absolute; bottom: 24px; left: 24px; color: var(--text-300); font-size: 0.85rem; pointer-events: none;">
                    右键空白处新增知识点 | Shift+拖拽节点连线 | 滚轮缩放 | 单击选中高亮
                </div>
            </div>
        `;

        this.initNetwork();
        this.bindEvents();
        this.initFilterLogic();
    }

    bindEvents() {
        this.root.querySelector('#stats-btn').onclick = () => this.showStatsModal();
        this.root.querySelector('#export-btn').onclick = () => this.showExportModal();

        // Import functionality
        const importInput = this.root.querySelector('#import-library-input');
        this.root.querySelector('#import-library-btn').onclick = () => importInput.click();
        importInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                Toast.show('正在导入...', 'info');
                const result = await store.importLibrary(file);
                Toast.show(`成功导入 ${result.count} 个知识库`, 'success');
                // Reload current view to show imported data
                window.location.reload();
            } catch (err) {
                console.error(err);
                Toast.show('导入失败: ' + err.message, 'error');
            }
            e.target.value = ''; // Reset input
        };
    }

    initFilterLogic() {
        let currentLogic = 'OR';
        const logicBtns = this.root.querySelectorAll('.filter-logic-btn');
        const checkboxes = this.root.querySelectorAll('#tag-filter-container input[type="checkbox"]');

        // Handle Logic Switch
        logicBtns.forEach(btn => {
            btn.onclick = () => {
                currentLogic = btn.dataset.logic;
                logicBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-300)';
                });
                btn.classList.add('active');
                btn.style.background = 'var(--primary-color)';
                btn.style.color = 'white';

                this.applyFilter(currentLogic);
            };
        });
        // Search
        const searchInput = this.root.querySelector('#search-input');
        searchInput.oninput = (e) => {
            const query = e.target.value.trim().toLowerCase();
            if (!this.network) return;

            if (!query) {
                this.network.highlightNodes(null);
                return;
            }

            const matchedIds = this.network.nodes
                .filter(n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query))
                .map(n => n.id);

            this.network.highlightNodes(matchedIds);
        };
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim().toLowerCase();
                if (!this.network || !query) return;

                const firstMatch = this.network.nodes
                    .find(n => n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query));

                if (firstMatch) {
                    this.network.focusNode(firstMatch.id);
                }
            }
        };

        // Handle Checkboxes
        checkboxes.forEach(cb => {
            cb.onchange = (e) => {
                const val = e.target.value;
                if (val === 'all') {
                    if (e.target.checked) {
                        // Uncheck others
                        checkboxes.forEach(c => {
                            if (c.value !== 'all') c.checked = false;
                        });
                    }
                } else {
                    // Uncheck 'all' if specific tag selected
                    if (e.target.checked) {
                        const allCb = this.root.querySelector('input[value="all"]');
                        if (allCb) allCb.checked = false;
                    }
                }

                // If nothing checked, check 'all'
                const anyChecked = Array.from(checkboxes).some(c => c.checked);
                if (!anyChecked) {
                    const allCb = this.root.querySelector('input[value="all"]');
                    if (allCb) allCb.checked = true;
                }

                this.applyFilter(currentLogic);
            };
        });
    }

    applyFilter(logic) {
        const checkboxes = this.root.querySelectorAll('#tag-filter-container input[type="checkbox"]');
        const selectedIds = [];
        let isAll = false;

        checkboxes.forEach(cb => {
            if (cb.checked) {
                if (cb.value === 'all') isAll = true;
                else selectedIds.push(cb.value);
            }
        });

        if (this.network) {
            this.network.updateFilter(isAll ? null : selectedIds, logic);
        }
    }

    async initNetwork() {
        // Dynamic import
        const { NetworkEngine } = await import('../network/engine.js?v=4');
        const canvas = document.getElementById('network-canvas');

        const points = await store.getPoints(this.libraryId);
        const links = await store.getLinks(this.libraryId);

        this.network = new NetworkEngine(canvas, {
            libraryId: this.libraryId,
            points: points,
            edges: links,
            libraryConfig: this.library,
            onContextMenu: (params) => this.handleContextMenu(params),
            onLink: (source, target) => this.handleCreateLink(source, target),
            onNodeDoubleClick: (node) => this.showNodeContentModal(node)
        });

        this.network.start();

        // 如果 URL 参数中指定了聚焦节点，则延迟聚焦（等待布局稳定）
        if (this.focusPointId) {
            setTimeout(() => {
                if (this.network) {
                    this.network.focusNode(this.focusPointId);
                    const node = this.network.nodes.find(n => n.id === this.focusPointId);
                    if (node) this.network.selectNode(node);
                }
            }, 600);
        }
    }

    // ================= Advanced Features =================

    async showStatsModal() {
        let currentMode = 'content';

        const buildContent = (data, mode) => {
            const topWords = data.slice(0, 10);
            const modeDesc = mode === 'content'
                ? '基于知识点内容进行中文分词统计'
                : '基于知识点标签进行统计';
            return `
                <div style="padding: 10px;">
                    <div style="display: flex; gap: 12px; margin-bottom: 16px; justify-content: center;">
                        <button class="btn ${mode === 'content' ? 'btn-primary' : 'btn-ghost'}" id="mode-content">内容模式</button>
                        <button class="btn ${mode === 'tag' ? 'btn-primary' : 'btn-ghost'}" id="mode-tag">标签模式</button>
                    </div>
                    <p style="text-align: center; font-size: 0.85rem; color: var(--text-300); margin-bottom: 12px;">${modeDesc}</p>
                    <div style="position: relative; height: 280px; background: var(--bg-dark-900); border-radius: 8px; overflow: hidden;">
                        <canvas id="wordcloud-canvas" style="width: 100%; height: 100%;"></canvas>
                    </div>
                    <div style="margin-top: 16px;">
                        <p style="font-weight: 600; margin-bottom: 8px;">Top 10 关键词${topWords.length === 0 ? ' (暂无数据 - 请先添加知识点)' : ''}:</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                            ${topWords.length > 0 ? topWords.map((w, i) => `
                                <span class="tag" style="background: linear-gradient(135deg, hsl(${220 - i * 15}, 70%, 50%) 0%, hsl(${220 - i * 15}, 70%, 40%) 100%);">
                                    ${w.word} (${w.count})
                                </span>
                            `).join('') : '<span style="color: var(--text-300);">请添加一些知识点后再查看统计</span>'}
                        </div>
                    </div>
                </div>
            `;
        };

        const drawWordCloud = (canvas, data) => {
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * 2;
            canvas.height = rect.height * 2;
            ctx.scale(2, 2);

            const width = rect.width;
            const height = rect.height;
            ctx.clearRect(0, 0, width, height);

            if (!data || data.length === 0) {
                ctx.fillStyle = '#666';
                ctx.font = '16px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('暂无数据', width / 2, height / 2);
                return;
            }

            const maxCount = Math.max(...data.map(w => w.count));
            const minSize = 12, maxSize = 48;
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

            // 简易词云布局：螺旋线算法
            const placed = [];
            const centerX = width / 2;
            const centerY = height / 2;

            data.slice(0, 30).forEach((word, i) => {
                const fontSize = minSize + ((word.count / maxCount) * (maxSize - minSize));
                ctx.font = `${fontSize}px Inter, sans-serif`;
                const textWidth = ctx.measureText(word.word).width;
                const textHeight = fontSize;

                // 螺旋线寻找位置
                let angle = 0, radius = 0;
                let x, y;
                let attempts = 0;
                const maxAttempts = 500;

                while (attempts < maxAttempts) {
                    x = centerX + radius * Math.cos(angle) - textWidth / 2;
                    y = centerY + radius * Math.sin(angle) + textHeight / 4;

                    // 边界检查
                    if (x > 5 && x + textWidth < width - 5 && y - textHeight > 5 && y < height - 5) {
                        // 碰撞检测
                        const bbox = { x, y: y - textHeight, w: textWidth, h: textHeight + 4 };
                        const collision = placed.some(p =>
                            !(bbox.x + bbox.w < p.x || bbox.x > p.x + p.w || bbox.y + bbox.h < p.y || bbox.y > p.y + p.h)
                        );

                        if (!collision) {
                            placed.push(bbox);
                            break;
                        }
                    }

                    angle += 0.5;
                    radius += 0.3;
                    attempts++;
                }

                if (attempts < maxAttempts) {
                    ctx.fillStyle = colors[i % colors.length];
                    ctx.fillText(word.word, x, y);
                }
            });
        };

        // 获取初始数据
        let data = [];
        try {
            const result = await store.getWordFrequency(this.libraryId, currentMode);
            data = result.data || [];
        } catch (e) {
            console.error('词频统计失败:', e);
        }

        const modal = new Modal({ title: '📊 词频统计', content: buildContent(data, currentMode), onConfirm: () => { } });
        modal.show();

        // 绘制词云
        setTimeout(() => {
            const canvas = document.getElementById('wordcloud-canvas');
            if (canvas) drawWordCloud(canvas, data);
        }, 100);

        // 绑定模式切换
        const bindModeSwitch = () => {
            document.getElementById('mode-content')?.addEventListener('click', async () => {
                if (currentMode === 'content') return;
                currentMode = 'content';
                try {
                    const result = await store.getWordFrequency(this.libraryId, currentMode);
                    data = result.data || [];
                    modal.setContent(buildContent(data, currentMode));
                    setTimeout(() => {
                        const canvas = document.getElementById('wordcloud-canvas');
                        if (canvas) drawWordCloud(canvas, data);
                        bindModeSwitch();
                    }, 50);
                } catch (e) { console.error(e); }
            });

            document.getElementById('mode-tag')?.addEventListener('click', async () => {
                if (currentMode === 'tag') return;
                currentMode = 'tag';
                try {
                    const result = await store.getWordFrequency(this.libraryId, currentMode);
                    data = result.data || [];
                    modal.setContent(buildContent(data, currentMode));
                    setTimeout(() => {
                        const canvas = document.getElementById('wordcloud-canvas');
                        if (canvas) drawWordCloud(canvas, data);
                        bindModeSwitch();
                    }, 50);
                } catch (e) { console.error(e); }
            });
        };
        setTimeout(bindModeSwitch, 100);
    }

    showExportModal() {
        const tags = this.library.tags || [];
        const content = `
            <div class="form-group">
                <label class="form-label">按标签筛选 (可多选，不选则导出全部)</label>
                <div style="max-height: 150px; overflow-y: auto; border: 1px solid var(--glass-border); border-radius: 6px; padding: 8px;">
                    ${tags.length > 0 ? tags.map(t => `
                        <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;">
                            <input type="checkbox" class="export-tag-checkbox" value="${t.name}">
                            <span class="tag" style="background-color: ${t.color};">${t.name}</span>
                        </label>
                    `).join('') : '<span style="color: var(--text-300);">暂无标签</span>'}
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">导出格式</label>
                <div style="display: flex; gap: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="export-format" value="json" checked> JSON
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="export-format" value="markdown"> Markdown
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="export-format" value="csv"> CSV
                    </label>
                </div>
            </div>
        `;

        const modal = new Modal({
            title: '📥 导出知识点',
            content,
            onConfirm: async () => {
                const selectedTags = [...document.querySelectorAll('.export-tag-checkbox:checked')]
                    .map(cb => cb.value);
                const format = document.querySelector('input[name="export-format"]:checked').value;

                try {
                    await store.exportLibrary(this.libraryId, format, selectedTags.length > 0 ? selectedTags : null);
                    modal.hide();
                    Toast.show('导出成功', 'success');
                } catch (e) {
                    Toast.show('导出失败: ' + e.message, 'error');
                }
            }
        });
        modal.show();
    }

    handleContextMenu({ event, node, edge, x, y, worldX, worldY }) {
        const items = [];
        const selectedCount = this.network.selectedNodes.length;

        if (node) {
            // Check if clicked node is part of selection
            const isInSelection = this.network.selectedNodes.includes(node);

            if (isInSelection && selectedCount > 1) {
                // Batch operations for multiple selected nodes
                items.push(
                    { label: `🗑️ 批量删除 (${selectedCount} 个节点)`, danger: true, action: () => this.handleBatchDeletePoints() },
                    { label: `📤 批量导出 (${selectedCount} 个节点)`, action: () => this.handleBatchExport() }
                );
            } else {
                // Single node operations
                items.push(
                    { label: '✨ 基于此添加新知识点', action: () => this.showCreateLinkedPointModal(node) },
                    { label: '✏️ 编辑知识点', action: () => this.showEditPointModal(node) },
                    { label: '🔗 添加链接 (输入ID)', action: () => this.showLinkByIdModal(node) },
                    { label: '📜 版本历史', action: () => this.showSnapshotModal(node) },
                    { label: '📤 导出相关知识点', action: () => this.exportRelatedPoints(node) },
                    { label: '🔗 删除与此节点的链接', danger: true, action: () => this.showDeleteLinksModal(node) },
                    { label: '🗑️ 删除知识点', danger: true, action: () => this.handleDeletePoint(node) }
                );
            }
        } else if (edge) {
            // Edge Context Menu
            items.push(
                { label: '✏️ 修改链接类型', action: () => this.showEditLinkModal(edge) },
                { label: '🗑️ 删除链接', danger: true, action: () => this.handleDeleteLink(edge) }
            );
        } else {
            // Background Context Menu
            items.push(
                { label: '✨ 新增知识点', action: () => this.showCreatePointModal(worldX, worldY) },
                { label: '📜 全局版本历史', action: () => this.showGlobalHistoryModal() }
            );
        }

        this.contextMenu.show(x, y, items);
    }

    // ================= 连线编辑/删除 =================

    showEditLinkModal(edge) {
        const content = `
            <div style="margin-bottom: 16px;">
                <p>当前链接: <strong>${edge.source.title}</strong> → <strong>${edge.target.title}</strong></p>
                <p style="margin-top: 8px; color: var(--text-300);">当前类型: ${edge.type === 'parent' ? '父级' : (edge.type === 'child' ? '子级' : '相关')}</p>
            </div>
            <div class="form-group">
                <label class="form-label">修改为</label>
                <select id="edit-link-type" class="form-select">
                    <option value="related" ${edge.type === 'related' ? 'selected' : ''}>🔗 相关</option>
                    <option value="parent" ${edge.type === 'parent' ? 'selected' : ''}>⬆️ 父级</option>
                    <option value="child" ${edge.type === 'child' ? 'selected' : ''}>⬇️ 子级</option>
                </select>
            </div>
        `;

        const modal = new Modal({
            title: '修改链接类型',
            content,
            onConfirm: async () => {
                const newType = document.getElementById('edit-link-type').value;
                if (newType === edge.type) {
                    modal.hide();
                    return;
                }

                // 目前后端没有直接修改链接类型的API，需要删除后重建
                try {
                    await store.deleteLink(edge.id);
                    const newLink = await store.createLink({
                        fromId: edge.source.id,
                        toId: edge.target.id,
                        type: newType
                    });

                    this.network.removeEdge(edge.id);
                    if (newLink) {
                        this.network.addEdge(newLink);
                    }

                    modal.hide();
                    Toast.show('链接类型已修改', 'success');
                } catch (e) {
                    Toast.show('修改失败: ' + e.message, 'error');
                }
            }
        });
        modal.show();
    }

    async handleDeleteLink(edge) {
        if (confirm(`确定要删除 "${edge.source.title}" 与 "${edge.target.title}" 之间的链接吗？`)) {
            // 保存用于撤销的数据
            const edgeData = {
                id: edge.id,
                fromId: edge.source.id,
                toId: edge.target.id,
                type: edge.type
            };

            await undoManager.execute({
                description: `删除链接 "${edge.source.title}" ↔ "${edge.target.title}"`,
                execute: async () => {
                    const success = await store.deleteLink(edgeData.id);
                    if (success) {
                        this.network.removeEdge(edgeData.id);
                        return true;
                    }
                    return false;
                },
                undo: async () => {
                    const newLink = await store.createLink({
                        fromId: edgeData.fromId,
                        toId: edgeData.toId,
                        type: edgeData.type
                    });
                    if (newLink) {
                        this.network.addEdge(newLink);
                        // 更新 edgeData.id 以便下次恢复时使用新 id
                        edgeData.id = newLink.id;
                    }
                }
            });

            Toast.show('链接已删除 (Ctrl+Z 撤销)', 'success');
        }
    }

    // ================= 全局版本历史 =================

    async showGlobalHistoryModal() {
        try {
            // 获取所有知识点的快照
            const allSnapshots = [];
            for (const point of this.network.nodes) {
                const snapshots = await store.getSnapshots(point.id);
                if (snapshots && snapshots.length > 0) {
                    snapshots.forEach(s => {
                        allSnapshots.push({
                            ...s,
                            pointId: point.id,
                            pointTitle: point.title
                        });
                    });
                }
            }

            // 按时间排序
            allSnapshots.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (allSnapshots.length === 0) {
                Toast.show('暂无版本历史记录', 'info');
                return;
            }

            const content = `
                <div style="max-height: 450px; overflow-y: auto;">
                    <p style="margin-bottom: 12px; color: var(--text-200);">共 ${allSnapshots.length} 条编辑记录</p>
                    ${allSnapshots.slice(0, 50).map(s => `
                        <div class="global-snapshot-item" data-point-id="${s.pointId}" data-snapshot-id="${s.id}" style="padding: 12px; margin-bottom: 8px; background: var(--bg-dark-900); border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: border-color 0.2s;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--primary-color); font-weight: 500;">${s.pointTitle}</span>
                                <span style="font-size: 0.8rem; color: var(--text-300);">${new Date(s.timestamp).toLocaleString('zh-CN')}</span>
                            </div>
                            <p style="margin-top: 6px; font-size: 0.85rem; color: var(--text-200); max-height: 40px; overflow: hidden; text-overflow: ellipsis;">${(s.content || '').slice(0, 100)}${(s.content || '').length > 100 ? '...' : ''}</p>
                        </div>
                    `).join('')}
                    ${allSnapshots.length > 50 ? `<p style="text-align: center; color: var(--text-300);">仅显示最近 50 条记录</p>` : ''}
                </div>
            `;

            const modal = new Modal({
                title: '📜 全局版本历史',
                content,
                onConfirm: () => { }
            });
            modal.show();

            // 绑定点击恢复
            modal.element.querySelectorAll('.global-snapshot-item').forEach(item => {
                item.onmouseenter = () => item.style.borderColor = 'var(--primary-color)';
                item.onmouseleave = () => item.style.borderColor = 'transparent';
                item.onclick = async () => {
                    const pointId = item.dataset.pointId;
                    const snapshotId = item.dataset.snapshotId;
                    if (!confirm('确定要恢复此版本吗？该知识点的当前内容将被覆盖。')) return;
                    try {
                        await store.restoreSnapshot(pointId, snapshotId);
                        modal.hide();
                        Toast.show('版本已恢复', 'success');
                        await this.render();
                    } catch (e) {
                        Toast.show('恢复失败: ' + e.message, 'error');
                    }
                };
            });
        } catch (e) {
            Toast.show('获取版本历史失败: ' + e.message, 'error');
        }
    }

    // ================= 添加关联知识点 =================

    showCreateLinkedPointModal(parentNode) {
        // 在父节点附近随机生成位置
        const offsetX = (Math.random() - 0.5) * 200;
        const offsetY = (Math.random() - 0.5) * 200;
        const x = parentNode.x + offsetX;
        const y = parentNode.y + offsetY;

        const buildForm = () => `
            <p style="margin-bottom: 12px; color: var(--text-200);">
                新知识点将自动与 <strong style="color: var(--primary-color);">${parentNode.title}</strong> 建立关联
            </p>
            <div class="form-group">
                <label class="form-label">标题 *</label>
                <input type="text" id="linked-point-title" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label">内容 *</label>
                <textarea id="linked-point-content" class="form-textarea"></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                    <label class="form-label">标签 *</label>
                    <select id="linked-point-tag" class="form-select">
                         <option value="">-- 未选择 --</option>
                         ${(this.library.tags || []).map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                         <option value="__NEW__">+ 新标签...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">出处 *</label>
                    <select id="linked-point-source" class="form-select">
                         <option value="">-- 未选择 --</option>
                         ${(this.library.sources || []).map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                         <option value="__NEW__">+ 新出处...</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">页码 *</label>
                <input type="text" id="linked-point-page" class="form-input" style="width: 100px;">
            </div>
            <div class="form-group">
                <label class="form-label">关系类型 *</label>
                <select id="linked-point-type" class="form-select">
                    <option value="parent">⬆️ 将当前知识点作为父知识点</option>
                    <option value="child">⬇️ 将当前知识点作为子知识点</option>
                    <option value="related">🔗 与当前知识点呈相关关系</option>
                </select>
            </div>
        `;

        const modal = new Modal({
            title: '添加关联知识点',
            content: buildForm(),
            onConfirm: async () => {
                const title = document.getElementById('linked-point-title').value;
                const content = document.getElementById('linked-point-content').value;
                let tag = document.getElementById('linked-point-tag').value;
                let source = document.getElementById('linked-point-source').value;
                const page = document.getElementById('linked-point-page').value;
                const linkType = document.getElementById('linked-point-type').value;

                if (!title || !content || !tag || !source || !page) {
                    Toast.show('请填写所有必填项', 'error');
                    return;
                }

                if (tag === '__NEW__') {
                    tag = prompt('输入新标签名');
                    if (!tag) return Toast.show('必须输入新标签名', 'error');
                }
                if (source === '__NEW__') {
                    source = prompt('输入新出处名');
                    if (!source) return Toast.show('必须输入新出处名', 'error');
                }

                // 处理新标签
                if (tag && !this.library.tags.find(t => t.name === tag)) {
                    const newTag = { name: tag, color: '#FF5722', id: Date.now().toString() };
                    this.library.tags.push(newTag);
                    await store.updateLibrary(this.libraryId, { tags: this.library.tags });
                }

                // 创建新知识点
                const newPoint = await store.createPoint({
                    libraryId: this.libraryId,
                    title, content, tags: [tag], source, page,
                    x, y
                });

                // 自动创建链接
                const newLink = await store.createLink({
                    fromId: parentNode.id,
                    toId: newPoint.id,
                    type: linkType
                });

                this.network.addNode(newPoint);
                if (newLink) {
                    this.network.addEdge(newLink);
                }

                modal.hide();
                Toast.show('关联知识点已创建', 'success');
            }
        });
        modal.show();
    }

    // ================= 导出知识图谱 (AI用) =================

    async exportKnowledgeGraph() {
        const points = this.network.nodes;
        const links = this.network.edges;

        const graphData = {
            library: {
                id: this.library.id,
                name: this.library.name,
                description: this.library.notes || this.library.description,
                tags: this.library.tags,
                sources: this.library.sources
            },
            points: points.map(p => ({
                id: p.id,
                title: p.title,
                content: p.content,
                tags: (p.tags || []).map(t => typeof t === 'string' ? t : t.name),
                source: p.source,
                page: p.page
            })),
            links: links.map(l => ({
                from: l.source.id,
                fromTitle: l.source.title,
                to: l.target.id,
                toTitle: l.target.title,
                type: l.type
            })),
            exportedAt: new Date().toISOString(),
            summary: `知识库「${this.library.name}」包含 ${points.length} 个知识点和 ${links.length} 条链接关系。`
        };

        const json = JSON.stringify(graphData, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${this.library.name}_知识图谱.json`;
        link.click();
        URL.revokeObjectURL(link.href);

        Toast.show('知识图谱已导出 (JSON格式，可供AI分析)', 'success');
    }

    // ================= 版本历史 =================

    async showSnapshotModal(node) {
        try {
            const snapshots = await store.getSnapshots(node.id);

            if (!snapshots || snapshots.length === 0) {
                Toast.show('暂无版本历史', 'info');
                return;
            }

            const content = `
                <div style="max-height: 400px; overflow-y: auto;">
                    <p style="margin-bottom: 12px; color: var(--text-200);">共 ${snapshots.length} 个历史版本</p>
                    ${snapshots.map((s, i) => `
                        <div class="snapshot-item" data-id="${s.id}" style="padding: 12px; margin-bottom: 8px; background: var(--bg-dark-900); border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: border-color 0.2s;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong style="color: var(--primary-color);">${s.title}</strong>
                                <span style="font-size: 0.8rem; color: var(--text-300);">${new Date(s.timestamp).toLocaleString('zh-CN')}</span>
                            </div>
                            <p style="margin-top: 8px; font-size: 0.9rem; color: var(--text-200); max-height: 60px; overflow: hidden; text-overflow: ellipsis;">${s.content.slice(0, 150)}${s.content.length > 150 ? '...' : ''}</p>
                        </div>
                    `).join('')}
                </div>
            `;

            const modal = new Modal({
                title: `📜 版本历史 - ${node.title}`,
                content,
                onConfirm: () => { }
            });
            modal.show();

            // 绑定点击恢复
            modal.element.querySelectorAll('.snapshot-item').forEach(item => {
                item.onmouseenter = () => item.style.borderColor = 'var(--primary-color)';
                item.onmouseleave = () => item.style.borderColor = 'transparent';
                item.onclick = async () => {
                    if (!confirm('确定要恢复到此版本吗？当前内容将被覆盖。')) return;
                    try {
                        await store.restoreSnapshot(node.id, item.dataset.id);
                        modal.hide();
                        Toast.show('版本已恢复', 'success');
                        // 刷新视图
                        await this.render();
                    } catch (e) {
                        Toast.show('恢复失败: ' + e.message, 'error');
                    }
                };
            });
        } catch (e) {
            Toast.show('获取版本历史失败: ' + e.message, 'error');
        }
    }

    // ================= 导出相关知识点 =================

    async exportRelatedPoints(node) {
        // 收集当前节点及其相邻节点
        const relatedIds = new Set([node.id]);
        this.network.edges.forEach(e => {
            if (e.source.id === node.id) relatedIds.add(e.target.id);
            if (e.target.id === node.id) relatedIds.add(e.source.id);
        });

        const relatedNodes = this.network.nodes.filter(n => relatedIds.has(n.id));

        // 生成 Markdown
        let markdown = `# ${node.title} 及其相关知识点\n\n`;
        markdown += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
        markdown += `知识库: ${this.library.name}\n\n---\n\n`;

        relatedNodes.forEach(n => {
            const tagStr = (n.tags || []).map(t => typeof t === 'string' ? t : t.name).join(', ');
            markdown += `## ${n.title}\n\n`;
            markdown += `**标签**: ${tagStr || '无'}\n\n`;
            markdown += `**出处**: ${n.source || '无'} (页码: ${n.page || '无'})\n\n`;
            markdown += `${n.content}\n\n---\n\n`;
        });

        // 下载
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${node.title}_相关知识点.md`;
        link.click();
        URL.revokeObjectURL(link.href);

        Toast.show(`已导出 ${relatedNodes.length} 个知识点`, 'success');
    }

    // ================= 删除链接 =================

    async showDeleteLinksModal(node) {
        // 获取与此节点相关的所有链接
        const relatedLinks = this.network.edges.filter(e =>
            e.source.id === node.id || e.target.id === node.id
        );

        if (relatedLinks.length === 0) {
            Toast.show('此节点没有任何链接', 'info');
            return;
        }

        const content = `
            <p style="margin-bottom: 12px;">选择要删除的链接 (共 ${relatedLinks.length} 条):</p>
            <div style="max-height: 300px; overflow-y: auto;">
                ${relatedLinks.map(link => {
            const other = link.source.id === node.id ? link.target : link.source;
            const direction = link.source.id === node.id ? '→' : '←';
            return `
                        <label style="display: flex; align-items: center; gap: 8px; padding: 8px; margin-bottom: 4px; background: var(--bg-dark-900); border-radius: 6px; cursor: pointer;">
                            <input type="checkbox" class="link-checkbox" data-id="${link.id}">
                            <span>${direction} ${other.title}</span>
                            <span class="tag" style="font-size: 0.75rem; padding: 2px 6px;">${link.type || 'related'}</span>
                        </label>
                    `;
        }).join('')}
            </div>
            <div style="margin-top: 12px;">
                <button class="btn btn-ghost" id="select-all-links">全选</button>
            </div>
        `;

        const modal = new Modal({
            title: `删除链接 - ${node.title}`,
            content,
            onConfirm: async () => {
                const checkboxes = modal.element.querySelectorAll('.link-checkbox:checked');
                if (checkboxes.length === 0) {
                    Toast.show('请选择要删除的链接', 'info');
                    return;
                }

                for (const cb of checkboxes) {
                    try {
                        await store.deleteLink(cb.dataset.id);
                        this.network.removeEdge(cb.dataset.id);
                    } catch (e) {
                        console.error('删除链接失败:', e);
                    }
                }

                modal.hide();
                Toast.show(`已删除 ${checkboxes.length} 条链接`, 'success');
            }
        });
        modal.show();

        // 绑定全选
        modal.element.querySelector('#select-all-links')?.addEventListener('click', () => {
            modal.element.querySelectorAll('.link-checkbox').forEach(cb => cb.checked = true);
        });
    }

    // ================= 通过ID建立链接 =================

    showLinkByIdModal(node) {
        const content = `
            <div class="form-group">
                <label class="form-label">目标知识点 ID</label>
                <input type="text" id="target-point-id" class="form-input" placeholder="输入知识点 ID">
            </div>
            <div class="form-group">
                <label class="form-label">链接类型</label>
                <select id="link-type" class="form-select">
                    <option value="related">🔗 相关</option>
                    <option value="parent">⬆️ 父级 (目标是父节点)</option>
                    <option value="child">⬇️ 子级 (目标是子节点)</option>
                </select>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-300); margin-top: 12px;">
                提示: 可以双击其他节点查看其 ID
            </p>
        `;

        const modal = new Modal({
            title: `添加链接 - ${node.title}`,
            content,
            onConfirm: async () => {
                const targetId = document.getElementById('target-point-id').value.trim();
                const linkType = document.getElementById('link-type').value;

                if (!targetId) {
                    Toast.show('请输入目标知识点 ID', 'error');
                    return;
                }

                // 检查目标节点是否存在
                const targetNode = this.network.nodes.find(n => n.id === targetId);
                if (!targetNode) {
                    Toast.show('未找到该 ID 的知识点', 'error');
                    return;
                }

                if (targetId === node.id) {
                    Toast.show('不能链接到自身', 'error');
                    return;
                }

                try {
                    const newLink = await store.createLink({
                        fromId: node.id,
                        toId: targetId,
                        type: linkType
                    });

                    if (newLink) {
                        this.network.addEdge(newLink);
                        modal.hide();
                        Toast.show('链接已创建', 'success');
                    } else {
                        Toast.show('链接已存在', 'info');
                    }
                } catch (e) {
                    Toast.show('创建链接失败: ' + e.message, 'error');
                }
            }
        });
        modal.show();
    }

    showCreatePointModal(x, y) {
        const buildForm = () => `
            <div class="form-group">
                <label class="form-label">标题 *</label>
                <input type="text" id="point-title" class="form-input">
            </div>
            <div class="form-group">
                <label class="form-label">内容 *</label>
                <textarea id="point-content" class="form-textarea"></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                    <label class="form-label">标签 *</label>
                    <select id="point-tag" class="form-select">
                         <option value="">-- 未选择 --</option>
                         ${(this.library.tags || []).map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                         <option value="__NEW__">+ 新标签...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">出处 *</label>
                    <select id="point-source" class="form-select">
                         <option value="">-- 未选择 --</option>
                         ${(this.library.sources || []).map(s => `<option value="${s.name}">${s.name}</option>`).join('')}
                         <option value="__NEW__">+ 新出处...</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">页码 *</label>
                <input type="text" id="point-page" class="form-input" style="width: 100px;">
            </div>
        `;

        const modal = new Modal({
            title: '新增知识点',
            content: buildForm(),
            onConfirm: async () => {
                const title = document.getElementById('point-title').value;
                const content = document.getElementById('point-content').value;
                let tag = document.getElementById('point-tag').value;
                let source = document.getElementById('point-source').value;
                const page = document.getElementById('point-page').value;

                // Strict Validation
                if (!title || !content || !tag || !source || !page) {
                    Toast.show('请填写所有必填项：标题、内容、标签、出处及页码', 'error');
                    return; // Strictly block
                }

                if (tag === '__NEW__') {
                    tag = prompt('输入新标签名');
                    if (!tag) return Toast.show('必须输入新标签名', 'error');
                }
                if (source === '__NEW__') {
                    source = prompt('输入新出处名');
                    if (!source) return Toast.show('必须输入新出处名', 'error');
                }

                // Ensure tag has color if new
                if (tag && !this.library.tags.find(t => t.name === tag)) {
                    const newTag = { name: tag, color: '#FF5722', id: Date.now().toString() };
                    this.library.tags.push(newTag);
                    await store.updateLibrary(this.libraryId, { tags: this.library.tags });
                }

                // 保存数据用于撤销
                const pointData = { libraryId: this.libraryId, title, content, tags: [tag], source, page, x, y };
                let createdPoint = null;

                await undoManager.execute({
                    description: `创建知识点 "${title}"`,
                    execute: async () => {
                        createdPoint = await store.createPoint(pointData);
                        if (createdPoint) {
                            this.network.addNode(createdPoint);
                            return true;
                        }
                        return false;
                    },
                    undo: async () => {
                        if (createdPoint) {
                            await store.deletePoint(createdPoint.id);
                            this.network.removeNode(createdPoint.id);
                        }
                    }
                });

                if (createdPoint) {
                    modal.hide();
                    Toast.show('知识点已创建 (Ctrl+Z 撤销)', 'success');
                }
            }
        });
        modal.show();
    }

    showNodeContentModal(node) {
        // Remove any existing content card
        const existingCard = document.getElementById('node-content-card');
        if (existingCard) {
            existingCard.remove();
        }

        // Get node position in screen coordinates
        const canvas = document.getElementById('network-canvas');
        const rect = canvas.getBoundingClientRect();
        const camera = this.network.camera;

        // Transform node world coordinates to screen coordinates
        const screenX = rect.left + (canvas.width / 2) + (node.x + camera.x) * camera.k;
        const screenY = rect.top + (canvas.height / 2) + (node.y + camera.y) * camera.k;

        // Create floating content card
        const card = document.createElement('div');
        card.id = 'node-content-card';
        card.style.cssText = `
            position: fixed;
            left: ${screenX + 50}px;
            top: ${screenY}px;
            width: 400px;
            max-width: 90vw;
            max-height: 500px;
            background: var(--bg-dark-800);
            border: 2px solid var(--primary-color);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            z-index: 10000;
            overflow-y: auto;
            animation: fadeIn 0.2s ease-out;
        `;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div style="flex: 1;">
                    <div style="font-size: 1.1rem; font-weight: 600; color: var(--primary-color); margin-bottom: 6px;">${node.title}</div>
                    <div style="color: var(--text-300); font-size: 0.8rem;">
                        📚 ${node.source || '未知来源'} ${node.page ? `· 第 ${node.page} 页` : ''}
                    </div>
                </div>
                <button id="close-content-card" style="background: none; border: none; color: var(--text-300); cursor: pointer; font-size: 1.5rem; padding: 0; line-height: 1; margin-left: 12px;">&times;</button>
            </div>
            <div style="background: var(--bg-dark-900); padding: 14px; border-radius: 8px; border: 1px solid var(--glass-border); margin-bottom: 12px; max-height: 300px; overflow-y: auto;">
                <div style="white-space: pre-wrap; line-height: 1.6; color: var(--text-200); font-size: 0.9rem;">${node.content || '无内容'}</div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${(node.tags || []).map(tag => {
            const tagObj = typeof tag === 'string'
                ? this.library.tags.find(t => t.name === tag)
                : tag;
            const color = tagObj?.color || '#888';
            const name = typeof tag === 'string' ? tag : tag.name;
            return `<span style="display: inline-block; padding: 3px 8px; background: ${color}22; border: 1px solid ${color}; border-radius: 12px; font-size: 0.75rem; color: ${color};">${name}</span>`;
        }).join('')}
            </div>
        `;

        document.body.appendChild(card);

        // Adjust position if card goes off screen
        const cardRect = card.getBoundingClientRect();
        if (cardRect.right > window.innerWidth) {
            card.style.left = `${screenX - cardRect.width - 50}px`;
        }
        if (cardRect.bottom > window.innerHeight) {
            card.style.top = `${window.innerHeight - cardRect.height - 20}px`;
        }
        if (cardRect.top < 0) {
            card.style.top = '20px';
        }

        // Close button handler
        document.getElementById('close-content-card').onclick = () => {
            card.remove();
        };

        // Close on click outside
        const closeOnClickOutside = (e) => {
            if (!card.contains(e.target)) {
                card.remove();
                document.removeEventListener('click', closeOnClickOutside);
            }
        };
        setTimeout(() => document.addEventListener('click', closeOnClickOutside), 100);

        // Close on Escape key
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                card.remove();
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
    }

    showEditPointModal(node) {
        // Find existing tag/source
        const currentTag = node.tags && node.tags.length ? (typeof node.tags[0] === 'string' ? node.tags[0] : node.tags[0].name) : '';
        const currentSource = node.source || '';

        const buildForm = () => `
            <div class="form-group">
                <label class="form-label">标题 *</label>
                <input type="text" id="edit-point-title" class="form-input" value="${node.title || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">内容 *</label>
                <textarea id="edit-point-content" class="form-textarea">${node.content || ''}</textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                    <label class="form-label">标签 *</label>
                    <select id="edit-point-tag" class="form-select">
                         <option value="">-- 未选择 --</option>
                         ${(this.library.tags || []).map(t => `<option value="${t.name}" ${t.name === currentTag ? 'selected' : ''}>${t.name}</option>`).join('')}
                         <option value="__NEW__">+ 新标签...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">出处 *</label>
                    <select id="edit-point-source" class="form-select">
                         <option value="">-- 未选择 --</option>
                         ${(this.library.sources || []).map(s => `<option value="${s.name}" ${s.name === currentSource ? 'selected' : ''}>${s.name}</option>`).join('')}
                         <option value="__NEW__">+ 新出处...</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">页码 *</label>
                <input type="text" id="edit-point-page" class="form-input" style="width: 100px;" value="${node.page || ''}">
            </div>
        `;

        const modal = new Modal({
            title: '编辑知识点',
            content: buildForm(),
            onConfirm: async () => {
                const title = document.getElementById('edit-point-title').value;
                const content = document.getElementById('edit-point-content').value;
                let tag = document.getElementById('edit-point-tag').value;
                let source = document.getElementById('edit-point-source').value;
                const page = document.getElementById('edit-point-page').value;

                if (!title || !content || !tag || !source || !page) {
                    Toast.show('请填写所有必填项', 'error');
                    return;
                }

                if (tag === '__NEW__') {
                    tag = prompt('输入新标签名');
                    if (!tag) return Toast.show('必须输入新标签名', 'error');
                }
                if (source === '__NEW__') {
                    source = prompt('输入新出处名');
                    if (!source) return Toast.show('必须输入新出处名', 'error');
                }

                if (tag && !this.library.tags.find(t => t.name === tag)) {
                    const newTag = { name: tag, color: '#FF5722', id: Date.now().toString() };
                    this.library.tags.push(newTag);
                    await store.updateLibrary(this.libraryId, { tags: this.library.tags });
                }

                // Update Store
                const updatedPoint = await store.updatePoint(node.id, {
                    title, content, tags: [tag], source, page
                });

                // Update Network Node (Locally)
                this.network.updateNode(node.id, updatedPoint);

                modal.hide();
                Toast.show('知识点已更新', 'success');
            }
        });
        modal.show();
    }

    async handleDeletePoint(node) {
        if (confirm(`确定要删除 "${node.title}" 吗？`)) {
            // 保存完整数据用于撤销恢复
            const nodeData = {
                id: node.id,
                libraryId: this.libraryId,
                title: node.title,
                content: node.content,
                tags: (node.tags || []).map(t => typeof t === 'string' ? t : t.name),
                source: node.source,
                page: node.page,
                x: node.x,
                y: node.y
            };
            // 保存相关链接
            const relatedLinks = this.network.edges
                .filter(e => e.source.id === node.id || e.target.id === node.id)
                .map(e => ({ fromId: e.source.id, toId: e.target.id, type: e.type, id: e.id }));

            await undoManager.execute({
                description: `删除知识点 "${node.title}"`,
                execute: async () => {
                    const success = await store.deletePoint(nodeData.id);
                    if (success) {
                        this.network.removeNode(nodeData.id);
                        return true;
                    }
                    return false;
                },
                undo: async () => {
                    // 重新创建知识点
                    const restored = await store.createPoint(nodeData);
                    this.network.addNode(restored);
                    nodeData.id = restored.id;  // 更新 id
                    // 重新创建链接
                    for (const link of relatedLinks) {
                        const from = link.fromId === nodeData.id ? restored.id : link.fromId;
                        const to = link.toId === nodeData.id ? restored.id : link.toId;
                        const newLink = await store.createLink({ fromId: from, toId: to, type: link.type });
                        if (newLink) this.network.addEdge(newLink);
                    }
                }
            });

            Toast.show('知识点已删除 (Ctrl+Z 撤销)', 'success');
        }
    }

    async handleBatchDeletePoints() {
        const selectedNodes = this.network.selectedNodes;
        const count = selectedNodes.length;

        // Collect all data for undo
        const deletedData = [];

        for (const node of selectedNodes) {
            const nodeData = {
                id: node.id,
                libraryId: this.libraryId,
                title: node.title,
                content: node.content,
                tags: (node.tags || []).map(t => typeof t === 'string' ? t : t.name),
                source: node.source,
                page: node.page,
                x: node.x,
                y: node.y
            };

            const relatedLinks = this.network.edges
                .filter(e => e.source.id === node.id || e.target.id === node.id)
                .map(e => ({
                    fromId: e.source.id,
                    toId: e.target.id,
                    type: e.type,
                    id: e.id
                }));

            deletedData.push({ nodeData, relatedLinks });
        }

        await undoManager.execute({
            description: `批量删除 ${count} 个知识点`,
            execute: async () => {
                for (const { nodeData } of deletedData) {
                    await store.deletePoint(nodeData.id);
                    this.network.removeNode(nodeData.id);
                }
                return true;
            },
            undo: async () => {
                // First, restore all deleted nodes
                const idMapping = {}; // Map old IDs to new IDs
                for (const { nodeData } of deletedData) {
                    const restored = await store.createPoint(nodeData);
                    this.network.addNode(restored);
                    idMapping[nodeData.id] = restored.id;
                }

                // Then, restore all links
                for (const { nodeData, relatedLinks } of deletedData) {
                    for (const link of relatedLinks) {
                        // Map old IDs to new IDs (or keep if node wasn't deleted)
                        const fromId = idMapping[link.fromId] || link.fromId;
                        const toId = idMapping[link.toId] || link.toId;

                        // Check if both nodes exist (either restored or never deleted)
                        const fromExists = this.network.nodes.find(n => n.id === fromId);
                        const toExists = this.network.nodes.find(n => n.id === toId);

                        if (fromExists && toExists) {
                            const newLink = await store.createLink({
                                fromId: fromId,
                                toId: toId,
                                type: link.type
                            });
                            if (newLink) this.network.addEdge(newLink);
                        }
                    }
                }
            }
        });

        Toast.show(`已删除 ${count} 个知识点 (Ctrl+Z 撤销)`, 'success');
        this.network.selectNode(null, false); // Clear selection
    }

    async handleBatchExport() {
        const selectedNodes = this.network.selectedNodes;
        const nodeIds = selectedNodes.map(n => n.id);

        // Get all links between selected nodes
        const relevantLinks = this.network.edges.filter(e =>
            nodeIds.includes(e.source.id) && nodeIds.includes(e.target.id)
        );

        const exportData = {
            library: {
                id: this.library.id,
                name: `${this.library.name} - 选中节点`,
                description: `从 ${this.library.name} 导出的 ${selectedNodes.length} 个知识点`,
                tags: this.library.tags,
                sources: this.library.sources
            },
            points: selectedNodes.map(n => ({
                id: n.id,
                title: n.title,
                content: n.content,
                tags: n.tags,
                source: n.source,
                page: n.page,
                x: n.x,
                y: n.y
            })),
            links: relevantLinks.map(e => ({
                from_id: e.source.id,
                to_id: e.target.id,
                type: e.type
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.library.name}_selected_${selectedNodes.length}nodes.json`;
        a.click();
        URL.revokeObjectURL(url);

        Toast.show(`已导出 ${selectedNodes.length} 个知识点`, 'success');
    }

    async handleCreateLink(source, target) {
        // Link Type Selection Modal
        const content = `
            <div style="display: flex; gap: 12px; justify-content: center; padding: 20px 0;">
                <button class="btn btn-ghost link-type-btn" data-type="related" style="flex: 1; border: 1px solid var(--glass-border);">
                    🔗 相关<br><span style="font-size: 0.8rem; color: var(--text-300);">Related</span>
                </button>
                <button class="btn btn-ghost link-type-btn" data-type="parent" style="flex: 1; border: 1px solid var(--glass-border);">
                    ⬅️ 我是它的父<br><span style="font-size: 0.8rem; color: var(--text-300);">I am Parent</span>
                </button>
                <button class="btn btn-ghost link-type-btn" data-type="child" style="flex: 1; border: 1px solid var(--glass-border);">
                    ➡️ 它是我的父<br><span style="font-size: 0.8rem; color: var(--text-300);">It is Parent</span>
                </button>
            </div>
        `;

        const modal = new Modal({
            title: '选择连接类型',
            content: content,
            // Custom footer or hide default footer? 
            // Modal component default has Confirm/Cancel. We want to trigger on button click.
            // But Modal.js binds confirm to a specific callback.
            // Hack: We'll inject click handlers after show.
            onConfirm: () => { } // Dummy
        });

        modal.show();

        // Hide default footer to force use of custom buttons
        const footer = modal.element.querySelector('.modal-footer');
        if (footer) footer.style.display = 'none';

        // Bind clicks
        modal.element.querySelectorAll('.link-type-btn').forEach(btn => {
            btn.onclick = async () => {
                const type = btn.dataset.type;
                modal.hide();

                // Logic based on type
                // Parent: Target is parent of Source? Or Source is parent of Target?
                // Usually "Drag from A to B": A is source.
                // If "Parent" selected: A is Parent of B.
                // If "Child" selected: A is Child of B.

                let linkData = { fromId: source.id, toId: target.id, type, libraryId: this.libraryId };

                // Adjust if relationship implies direction swap or just property
                // For now, we store 'type' on the link.

                let createdLink = null;

                await undoManager.execute({
                    description: `创建链接 "${source.title}" → "${target.title}"`,
                    execute: async () => {
                        createdLink = await store.createLink(linkData);
                        if (createdLink) {
                            // 1. Remove any existing links between these nodes (Frontend update)
                            // Backend already deleted them, but we need to sync frontend state
                            const existingEdges = this.network.edges.filter(e =>
                                (e.source.id === source.id && e.target.id === target.id) ||
                                (e.source.id === target.id && e.target.id === source.id)
                            );
                            existingEdges.forEach(e => this.network.removeEdge(e.id));

                            this.network.addEdge(createdLink);
                            return true;
                        }
                        return false;
                    },
                    undo: async () => {
                        if (createdLink) {
                            await store.deleteLink(createdLink.id);
                            this.network.removeEdge(createdLink.id);
                        }
                    }
                });

                if (createdLink) {
                    Toast.show(`已建立连接 (Ctrl+Z 撤销)`, 'success');
                }
            };
        });
    }

    destroy() {
        if (this.network) this.network.stop();
        this.contextMenu.hide();
        window.removeEventListener('keydown', this.handleKeyDown);
        undoManager.clear();  // 清空撤销历史
    }

    // ================= 键盘快捷键 =================

    async handleKeyDown(e) {
        // Ctrl+Z 撤销
        if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            if (undoManager.canUndo()) {
                try {
                    const action = await undoManager.undo();
                    if (action) {
                        Toast.show(`已撤销: ${action.description}`, 'info');
                    }
                } catch (err) {
                    Toast.show('撤销失败', 'error');
                }
            } else {
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
                    Toast.show('恢复失败', 'error');
                }
            } else {
                Toast.show('没有可恢复的操作', 'info');
            }
        }
    }
}
