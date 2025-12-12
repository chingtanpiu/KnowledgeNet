export class Toast {
    static show(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container') || this.createContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type} fade-in-up`;
        toast.innerText = message;

        // Inline styles for simplicity
        Object.assign(toast.style, {
            background: 'var(--bg-dark-600)',
            color: 'var(--text-100)',
            padding: '12px 24px',
            marginTop: '12px',
            borderRadius: '8px',
            borderLeft: `4px solid ${this.getColor(type)}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.9rem',
            zIndex: 10000,
            pointerEvents: 'auto'
        });

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }

    static createContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        Object.assign(container.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none'
        });
        document.body.appendChild(container);
        return container;
    }

    static getColor(type) {
        switch (type) {
            case 'success': return 'var(--success-color, #4CAF50)';
            case 'error': return 'var(--danger-color, #F44336)';
            case 'warning': return '#FFC107';
            default: return 'var(--primary-color, #2196F3)';
        }
    }
}
