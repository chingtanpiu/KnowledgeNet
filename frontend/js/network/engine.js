export class NetworkEngine {
    constructor(canvas, { libraryId, points, edges = [], libraryConfig, onContextMenu, onLink }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.libraryId = libraryId;
        this.libraryConfig = libraryConfig;
        this.onContextMenu = onContextMenu;
        this.onLink = onLink; // Callback for link creation

        // Data
        this.nodes = points.map(p => ({
            ...p,
            x: p.x || (Math.random() - 0.5) * 800,
            y: p.y || (Math.random() - 0.5) * 600,
            radius: 30,
            vx: 0,
            vy: 0
        }));

        // Edges need reference to node objects
        this.edges = [];
        this.loadEdges(edges);

        // Camera / Viewport
        this.camera = { x: 0, y: 0, k: 1 };

        // Interactions
        this.isDraggingCanvas = false;
        this.isDraggingNode = false;
        this.draggedNode = null;
        this.lastMouse = { x: 0, y: 0 };
        this.hoveredNode = null;
        this.hoveredEdge = null;  // 悬停的连线

        // Linking Interaction
        this.linkingNode = null; // Node we are dragging a link FROM
        this.tempLinkEnd = { x: 0, y: 0 }; // Current mouse pos for temp line

        this.running = false;
        this.animationId = null;

        // Highlighting
        this.selectedNode = null;
        this.relatedNodes = new Set(); // Nodes connected to selected

        this.bindEvents();
        this.resize();
    }

    loadEdges(rawEdges) {
        // Map edges to actual node objects for physics/rendering
        this.edges = rawEdges.map(e => {
            const source = this.nodes.find(n => n.id === e.fromId);
            const target = this.nodes.find(n => n.id === e.toId);
            return source && target ? { ...e, source, target } : null;
        }).filter(e => e);
    }

    addNode(point) {
        const node = {
            ...point,
            x: -this.camera.x + (Math.random() - 0.5) * 100, // Spawn near center view
            y: -this.camera.y + (Math.random() - 0.5) * 100,
            radius: 30,
            vx: 0, vy: 0
        };
        this.nodes.push(node);
    }

    updateNode(id, updates) {
        const idx = this.nodes.findIndex(n => n.id === id);
        if (idx !== -1) {
            this.nodes[idx] = { ...this.nodes[idx], ...updates };
        }
    }

    removeNode(id) {
        this.nodes = this.nodes.filter(n => n.id !== id);
        this.edges = this.edges.filter(e => e.source.id !== id && e.target.id !== id);
    }

    addEdge(edge) {
        const source = this.nodes.find(n => n.id === edge.fromId);
        const target = this.nodes.find(n => n.id === edge.toId);
        if (source && target) {
            this.edges.push({ ...edge, source, target });
        }
    }

    removeEdge(id) {
        this.edges = this.edges.filter(e => e.id !== id);
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.loop();
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this.animationId);
    }

    loop() {
        if (!this.running) return;
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    update() {
        if (!this.running) return;

        const repulsion = 2000;
        const springLength = 150;
        const k = 0.05;
        const damping = 0.85;

        // 1. Repulsion
        for (let i = 0; i < this.nodes.length; i++) {
            let nodeA = this.nodes[i];
            for (let j = i + 1; j < this.nodes.length; j++) {
                let nodeB = this.nodes[j];
                let dx = nodeA.x - nodeB.x;
                let dy = nodeA.y - nodeB.y;
                let distSq = dx * dx + dy * dy || 1;
                let dist = Math.sqrt(distSq);

                let force = repulsion / distSq;
                let fx = (dx / dist) * force;
                let fy = (dy / dist) * force;

                if (!this.isDraggingNode || this.draggedNode !== nodeA) {
                    nodeA.vx += fx;
                    nodeA.vy += fy;
                }
                if (!this.isDraggingNode || this.draggedNode !== nodeB) {
                    nodeB.vx -= fx;
                    nodeB.vy -= fy;
                }
            }
        }

        // 2. Attraction
        this.edges.forEach(edge => {
            let dx = edge.target.x - edge.source.x;
            let dy = edge.target.y - edge.source.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Hooke's Law
            let force = (dist - springLength) * k;
            let fx = (dx / dist) * force;
            let fy = (dy / dist) * force;

            if (!this.isDraggingNode || this.draggedNode !== edge.source) {
                edge.source.vx += fx;
                edge.source.vy += fy;
            }
            if (!this.isDraggingNode || this.draggedNode !== edge.target) {
                edge.target.vx -= fx;
                edge.target.vy -= fy;
            }
        });

        // 3. Center Gravity
        this.nodes.forEach(node => {
            if (this.isDraggingNode && this.draggedNode === node) return;

            let dx = 0 - node.x;
            let dy = 0 - node.y;
            node.vx += dx * 0.005;
            node.vy += dy * 0.005;

            node.vx *= damping;
            node.vy *= damping;

            node.x += node.vx;
            node.y += node.vy;
        });
    }

    draw() {
        const { width, height } = this.canvas;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, width, height);

        ctx.save();
        ctx.translate(width / 2 + this.camera.x, height / 2 + this.camera.y);
        ctx.scale(this.camera.k, this.camera.k);

        // Draw Links
        this.edges.forEach(edge => this.drawEdge(ctx, edge));

        // Draw Temp Link (Dragging)
        if (this.linkingNode) {
            ctx.beginPath();
            ctx.moveTo(this.linkingNode.x, this.linkingNode.y);
            // Temp end needs to be transformed to world space? 
            // Actually tempLinkEnd is stored in World Space in mouseMove
            ctx.lineTo(this.tempLinkEnd.x, this.tempLinkEnd.y);
            ctx.strokeStyle = '#FFFFFF';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw Nodes
        this.nodes.forEach(node => this.drawNode(ctx, node));

        ctx.restore();
    }

    drawEdge(ctx, edge) {
        // 根据链接类型设置不同样式
        let color, dashPattern, lineWidth;
        switch (edge.type) {
            case 'parent':
                color = '#4ECDC4';  // 青色 - 父级关系
                dashPattern = [];   // 实线
                lineWidth = 3;
                break;
            case 'child':
                color = '#FF6B6B';  // 红色 - 子级关系
                dashPattern = [];   // 实线
                lineWidth = 3;
                break;
            case 'related':
            default:
                color = '#607D8B';  // 灰色 - 相关关系
                dashPattern = [8, 4]; // 虚线
                lineWidth = 2;
                break;
        }

        // 悬停时高亮
        const isHovered = edge === this.hoveredEdge;
        if (isHovered) {
            color = '#FFFFFF';  // 白色高亮
            lineWidth += 2;
        }

        ctx.beginPath();
        ctx.setLineDash(dashPattern);
        ctx.moveTo(edge.source.x, edge.source.y);
        ctx.lineTo(edge.target.x, edge.target.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        ctx.setLineDash([]);  // 重置虚线

        // Arrow logic - 只有父子关系才画箭头，关联关系不画
        if (edge.type === 'parent' || edge.type === 'child') {
            const angle = Math.atan2(edge.target.y - edge.source.y, edge.target.x - edge.source.x);
            const r = edge.target.radius + 5; // Offset from center
            const arrowX = edge.target.x - r * Math.cos(angle);
            const arrowY = edge.target.y - r * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(arrowX - 10 * Math.cos(angle - Math.PI / 6), arrowY - 10 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(arrowX - 10 * Math.cos(angle + Math.PI / 6), arrowY - 10 * Math.sin(angle + Math.PI / 6));
            ctx.fillStyle = color;
            ctx.fill();
        }

        // 在边上显示类型标签（仅当选中相关节点时）
        if (this.selectedNode && (edge.source === this.selectedNode || edge.target === this.selectedNode)) {
            const midX = (edge.source.x + edge.target.x) / 2;
            const midY = (edge.source.y + edge.target.y) / 2;
            const typeLabel = edge.type === 'parent' ? '父' : (edge.type === 'child' ? '子' : '关');

            ctx.font = '10px Inter, sans-serif';
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 背景
            ctx.beginPath();
            ctx.arc(midX, midY, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#1e1e2d';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 文字
            ctx.fillStyle = color;
            ctx.fillText(typeLabel, midX, midY);
        }
    }

    drawNode(ctx, node) {
        const isHovered = node === this.hoveredNode;
        const isLinking = node === this.linkingNode;

        let color = '#3F51B5';
        // Get color from tag
        if (node.tags && node.tags.length > 0 && this.libraryConfig.tags) {
            const tagName = typeof node.tags[0] === 'string' ? node.tags[0] : node.tags[0].name;
            const tagConfig = this.libraryConfig.tags.find(t => t.name === tagName);
            if (tagConfig) color = tagConfig.color;
        }

        // Dimming Logic
        const isSelected = node === this.selectedNode;
        const isRelated = this.relatedNodes.has(node);
        const dimData = this.selectedNode && !isSelected && !isRelated;

        if (dimData) {
            ctx.globalAlpha = 0.2;
        }

        // Shadow/Glow
        if (isHovered || isLinking || isSelected) {
            ctx.shadowColor = color;
            ctx.shadowBlur = isSelected ? 30 : 20;
        } else {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 6;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1e2d';
        ctx.fill();

        ctx.lineWidth = isLinking || isSelected ? 4 : (isHovered ? 3 : 2);
        ctx.strokeStyle = isLinking || isSelected ? '#FFFFFF' : color;
        ctx.stroke();

        // Label
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = isSelected ? 'bold 14px Inter, sans-serif' : '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.title, node.x, node.y);

        ctx.globalAlpha = 1; // Reset
    }

    selectNode(node) {
        this.selectedNode = node;
        this.relatedNodes.clear();
        if (node) {
            this.edges.forEach(e => {
                if (e.source === node) this.relatedNodes.add(e.target);
                if (e.target === node) this.relatedNodes.add(e.source);
            });
        }
        this.draw();
    }

    // ================= Interactions =================

    bindEvents() {
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
        window.addEventListener('mousemove', e => this.onMouseMove(e));
        window.addEventListener('mouseup', e => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', e => this.onWheel(e));
        this.canvas.addEventListener('contextmenu', e => this.onContextMenuEvent(e));
        this.canvas.addEventListener('dblclick', e => this.onDoubleClick(e));
    }

    onDoubleClick(e) {
        const pos = this.getMouseWorldPos(e);
        const clickedNode = this.hitTest(pos);

        if (clickedNode) {
            // 显示节点 ID，方便复制
            const idDisplay = document.createElement('div');
            idDisplay.style.cssText = `
                position: fixed;
                left: ${e.clientX + 10}px;
                top: ${e.clientY + 10}px;
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.9);
                color: #fff;
                border-radius: 6px;
                font-family: monospace;
                font-size: 12px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                user-select: all;
                cursor: text;
            `;
            idDisplay.innerHTML = `
                <div style="margin-bottom: 4px; color: #aaa; font-size: 10px;">知识点 ID (可选中复制)</div>
                <div style="color: #4ECDC4;">${clickedNode.id}</div>
            `;
            document.body.appendChild(idDisplay);

            // 3秒后自动消失，或点击其他地方消失
            const remove = () => {
                idDisplay.remove();
                document.removeEventListener('click', remove);
            };
            setTimeout(remove, 5000);
            setTimeout(() => document.addEventListener('click', remove), 100);
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.draw();
    }

    getMouseWorldPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;
        const x = (clientX - this.canvas.width / 2 - this.camera.x) / this.camera.k;
        const y = (clientY - this.canvas.height / 2 - this.camera.y) / this.camera.k;
        return { x, y, clientX, clientY };
    }

    onMouseDown(e) {
        if (e.button !== 0) return; // Only left click

        const pos = this.getMouseWorldPos(e);
        this.lastMouse = { x: e.clientX, y: e.clientY };

        const clickedNode = this.hitTest(pos);

        if (e.shiftKey && clickedNode) {
            // Start Linking Mode
            this.linkingNode = clickedNode;
            this.tempLinkEnd = { x: clickedNode.x, y: clickedNode.y };
        } else if (clickedNode) {
            this.isDraggingNode = true;
            this.draggedNode = clickedNode;
            this.selectNode(clickedNode); // Highlight interactions
        } else {
            this.isDraggingCanvas = true;
            this.canvas.style.cursor = 'grabbing';
            this.selectNode(null); // Deselect on background click
        }
    }

    onMouseMove(e) {
        const pos = this.getMouseWorldPos(e);

        // Hover - 检测节点和连线
        if (!this.isDraggingCanvas && !this.isDraggingNode && !this.linkingNode) {
            this.hoveredNode = this.hitTest(pos);
            this.hoveredEdge = this.hoveredNode ? null : this.edgeHitTest(pos);
            this.canvas.style.cursor = (this.hoveredNode || this.hoveredEdge) ? 'pointer' : 'grab';
        }

        // Dragging Node
        if (this.isDraggingNode && this.draggedNode) {
            this.draggedNode.x = pos.x;
            this.draggedNode.y = pos.y;
            this.draggedNode.vx = 0; // Stop physics
            this.draggedNode.vy = 0;
        }
        // Panning
        else if (this.isDraggingCanvas) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.camera.x += dx;
            this.camera.y += dy;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        }
        // Linking
        else if (this.linkingNode) {
            this.tempLinkEnd = { x: pos.x, y: pos.y };
            this.hoveredNode = this.hitTest(pos); // Check if hovering over potential target
        }
    }

    onMouseUp(e) {
        // Finish Linking
        if (this.linkingNode) {
            const pos = this.getMouseWorldPos(e);
            const targetNode = this.hitTest(pos);

            if (targetNode && targetNode !== this.linkingNode) {
                if (this.onLink) {
                    this.onLink(this.linkingNode, targetNode);
                }
            }
            this.linkingNode = null;
        }

        this.isDraggingCanvas = false;
        this.isDraggingNode = false;
        this.draggedNode = null;
        this.canvas.style.cursor = 'grab';
    }

    onWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);
        this.camera.k = Math.max(0.1, Math.min(5, this.camera.k * zoom));
        this.draw();
    }

    onContextMenuEvent(e) {
        e.preventDefault();
        const pos = this.getMouseWorldPos(e);
        const clickedNode = this.hitTest(pos);
        const clickedEdge = clickedNode ? null : this.edgeHitTest(pos);

        if (this.onContextMenu) {
            this.onContextMenu({
                event: e,
                node: clickedNode,
                edge: clickedEdge,  // 新增连线参数
                x: e.clientX,
                y: e.clientY,
                worldX: pos.x,
                worldY: pos.y
            });
        }
    }

    hitTest(pos) {
        return this.nodes.find(n => {
            const dx = n.x - pos.x;
            const dy = n.y - pos.y;
            return dx * dx + dy * dy < n.radius * n.radius;
        });
    }

    // 连线碰撞检测 - 检测点到线段的距离
    edgeHitTest(pos) {
        const threshold = 8; // 像素阈值
        for (const edge of this.edges) {
            const dist = this.pointToSegmentDistance(pos, edge.source, edge.target);
            if (dist < threshold) {
                return edge;
            }
        }
        return null;
    }

    // 计算点到线段的距离
    pointToSegmentDistance(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        const closestX = a.x + t * dx;
        const closestY = a.y + t * dy;

        return Math.hypot(p.x - closestX, p.y - closestY);
    }
}
