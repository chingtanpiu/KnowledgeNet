export class ColorPicker {
    constructor({ container, onSelect, usedColors = [] }) {
        this.container = container;
        this.onSelect = onSelect;
        this.usedColors = new Set(usedColors);
        this.selectedColor = null;

        this.palette = [
            '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
            '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
            '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
            '#FF5722', '#795548', '#9E9E9E', '#607D8B'
        ];
    }

    render() {
        this.container.innerHTML = `
            <div class="color-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(24px, 1fr)); gap: 8px;">
                ${this.palette.map(color => {
            const isUsed = this.usedColors.has(color);
            const isSelected = this.selectedColor === color;
            return `
                        <div class="color-swatch ${isSelected ? 'selected' : ''} ${isUsed ? 'disabled' : ''}" 
                             style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; transition: transform 0.2s; position: relative;"
                             data-color="${color}"
                             title="${isUsed ? '已占用' : color}">
                             ${isSelected ? '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 12px; font-weight: bold;">✓</span>' : ''}
                        </div>
                    `;
        }).join('')}
            </div>
            <style>
                .color-swatch:hover:not(.disabled) { transform: scale(1.2); z-index: 10; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
                .color-swatch.selected { border: 2px solid white; box-shadow: 0 0 0 2px var(--primary-color); transform: scale(1.1); }
                .color-swatch.disabled { opacity: 0.2; cursor: not-allowed; }
            </style>
        `;

        this.container.querySelectorAll('.color-swatch').forEach(el => {
            el.onclick = () => {
                const color = el.dataset.color;
                if (this.usedColors.has(color)) return;

                this.selectedColor = color;
                this.render(); // Re-render to show selection
                if (this.onSelect) this.onSelect(color);
            };
        });
    }

    setUsedColors(colors) {
        this.usedColors = new Set(colors);
        this.render();
    }

    reset() {
        this.selectedColor = null;
        this.render();
    }
}
