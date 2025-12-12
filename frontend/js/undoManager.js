/**
 * UndoManager - 撤销/恢复管理器
 * 使用命令模式实现操作的撤销和恢复
 */

class UndoManager {
    constructor() {
        this.undoStack = [];  // 撤销栈
        this.redoStack = [];  // 恢复栈
        this.maxStackSize = 50;  // 最大栈大小
    }

    /**
     * 执行一个可撤销的操作
     * @param {Object} action - 包含 execute 和 undo 方法的操作对象
     * @param {string} action.description - 操作描述
     * @param {Function} action.execute - 执行操作的函数
     * @param {Function} action.undo - 撤销操作的函数
     */
    async execute(action) {
        try {
            await action.execute();
            this.undoStack.push(action);
            this.redoStack = [];  // 执行新操作后清空恢复栈

            // 限制栈大小
            if (this.undoStack.length > this.maxStackSize) {
                this.undoStack.shift();
            }

            console.log(`[Undo] 执行: ${action.description}`);
        } catch (e) {
            console.error('[Undo] 执行失败:', e);
            throw e;
        }
    }

    /**
     * 撤销上一个操作
     */
    async undo() {
        if (this.undoStack.length === 0) {
            console.log('[Undo] 没有可撤销的操作');
            return null;
        }

        const action = this.undoStack.pop();
        try {
            await action.undo();
            this.redoStack.push(action);
            console.log(`[Undo] 撤销: ${action.description}`);
            return action;
        } catch (e) {
            console.error('[Undo] 撤销失败:', e);
            // 撤销失败，放回撤销栈
            this.undoStack.push(action);
            throw e;
        }
    }

    /**
     * 恢复上一个被撤销的操作
     */
    async redo() {
        if (this.redoStack.length === 0) {
            console.log('[Undo] 没有可恢复的操作');
            return null;
        }

        const action = this.redoStack.pop();
        try {
            await action.execute();
            this.undoStack.push(action);
            console.log(`[Undo] 恢复: ${action.description}`);
            return action;
        } catch (e) {
            console.error('[Undo] 恢复失败:', e);
            // 恢复失败，放回恢复栈
            this.redoStack.push(action);
            throw e;
        }
    }

    /**
     * 检查是否可以撤销
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * 检查是否可以恢复
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * 清空所有历史
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}

// 全局单例
export const undoManager = new UndoManager();
