import { store } from './store.js';
import { HomeView } from './views/homeView.js';
import { LibraryView } from './views/libraryView.js';

class App {
    constructor() {
        this.appElement = document.getElementById('app');
        this.routes = {
            'home': HomeView,
            'library': LibraryView
        };
        this.currentView = null;
    }

    async init() {
        // Simple routing based on hash or state
        this.navigateTo('home');
    }

    async navigateTo(route, params = {}) {
        const ViewClass = this.routes[route];
        if (!ViewClass) {
            console.error(`Route ${route} not found`);
            return;
        }

        // Cleanup current view
        if (this.currentView && this.currentView.destroy) {
            this.currentView.destroy();
        }

        // Initialize new view
        this.currentView = new ViewClass(this.appElement, params);
        await this.currentView.render();
    }
}

const app = new App();
window.app = app; // For debugging and global access
app.init();
