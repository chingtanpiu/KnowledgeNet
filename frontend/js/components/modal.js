export class Modal {
    constructor({ title, content, onConfirm, onCancel }) {
        this.title = title;
        this.content = content; // HTML string or Element
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
        this.element = null;
    }

    render() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const html = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${this.title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Content injected here -->
                </div>
                <div class="modal-footer" style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
                    <button class="btn btn-ghost cancel-btn">取消</button>
                    <button class="btn btn-primary confirm-btn">确认</button>
                </div>
            </div>
        `;

        overlay.innerHTML = html;
        this.element = overlay;

        // Inject Body Content
        const bodyMsg = overlay.querySelector('.modal-body');
        if (typeof this.content === 'string') {
            bodyMsg.innerHTML = this.content;
        } else if (this.content instanceof Element) {
            bodyMsg.appendChild(this.content);
        }

        // Bind Events
        overlay.querySelector('.modal-close').onclick = () => this.hide();
        overlay.querySelector('.cancel-btn').onclick = () => {
            this.hide();
            if (this.onCancel) this.onCancel();
        };
        overlay.querySelector('.confirm-btn').onclick = () => {
            if (this.onConfirm) this.onConfirm();
        };

        // Close on backdrop click
        overlay.onclick = (e) => {
            if (e.target === overlay) this.hide();
        };

        document.body.appendChild(overlay);

        // Trigger reflow for animation
        setTimeout(() => overlay.classList.add('active'), 10);
    }

    show() {
        if (!this.element) this.render();
    }

    hide() {
        if (this.element) {
            this.element.classList.remove('active');
            setTimeout(() => {
                this.element.remove();
                this.element = null;
            }, 300);
        }
    }

    setContent(content) {
        if (!this.element) return;
        const bodyMsg = this.element.querySelector('.modal-body');
        if (!bodyMsg) return;

        if (typeof content === 'string') {
            bodyMsg.innerHTML = content;
        } else if (content instanceof Element) {
            bodyMsg.innerHTML = '';
            bodyMsg.appendChild(content);
        }
    }
}
