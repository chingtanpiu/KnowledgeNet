export class ContextMenu {
    constructor() {
        this.element = null;
    }

    show(x, y, items) {
        this.hide(); // Close existing

        this.element = document.createElement('div');
        this.element.className = 'context-menu glass-panel';
        Object.assign(this.element.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            zIndex: 1000,
            minWidth: '160px',
            padding: '4px 0',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        });

        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'context-menu-item';
            row.innerText = item.label;

            if (item.danger) {
                row.style.color = 'var(--danger-color)';
            }

            row.onclick = (e) => {
                e.stopPropagation();
                this.hide();
                item.action();
            };

            this.element.appendChild(row);
        });

        // Add global styling for items if not present
        if (!document.getElementById('context-menu-style')) {
            const style = document.createElement('style');
            style.id = 'context-menu-style';
            style.textContent = `
                .context-menu-item {
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    color: var(--text-100);
                    transition: background 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .context-menu-item:hover {
                    background: var(--bg-dark-600);
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(this.element);

        // Adjust position if off-screen
        const rect = this.element.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.element.style.left = `${window.innerWidth - rect.width - 8}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.element.style.top = `${window.innerHeight - rect.height - 8}px`;
        }

        // Click outside listener
        setTimeout(() => {
            window.addEventListener('click', this.handleOutsideClick);
            window.addEventListener('contextmenu', this.handleOutsideClick);
        }, 0);
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
            window.removeEventListener('click', this.handleOutsideClick);
            window.removeEventListener('contextmenu', this.handleOutsideClick);
        }
    }

    handleOutsideClick = (e) => {
        if (this.element && !this.element.contains(e.target)) {
            this.hide();
        }
    }
}
