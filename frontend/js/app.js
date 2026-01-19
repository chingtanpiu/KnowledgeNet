import { store } from './store.js';
import { HomeView } from './views/homeView.js?v=8';
import { LibraryView } from './views/libraryView.js';

class App {
    constructor() {
        this.appElement = document.getElementById('app');
        this.routes = {
            'home': HomeView,
            'library': LibraryView
        };
        this.currentView = null;

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleHashChange());
    }

    async init() {
        // Check if there's a hash in the URL, otherwise go to home
        this.handleHashChange();
    }

    handleHashChange() {
        const hash = window.location.hash.slice(1); // Remove the '#'

        if (!hash) {
            this.navigateTo('home');
            return;
        }

        // Parse hash format: #route/param1/param2?key=value
        const [pathPart, queryPart] = hash.split('?');
        const pathSegments = pathPart.split('/');
        const route = pathSegments[0];

        // Parse parameters
        const params = {};

        // Path parameters (e.g., #library/123 -> id: 123)
        if (route === 'library' && pathSegments[1]) {
            params.id = pathSegments[1];
        }

        // Query parameters (e.g., ?focus=456)
        if (queryPart) {
            queryPart.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                params[decodeURIComponent(key)] = decodeURIComponent(value);
            });
        }

        this.navigateTo(route, params, false); // false = don't update hash (already set)
    }

    async navigateTo(route, params = {}, updateHash = true) {
        const ViewClass = this.routes[route];
        if (!ViewClass) {
            console.error(`Route ${route} not found`);
            return;
        }

        // Update URL hash if needed
        if (updateHash) {
            let hash = `#${route}`;

            if (route === 'library' && params.id) {
                hash += `/${params.id}`;

                // Add query parameters
                const queryParams = [];
                if (params.focus) {
                    queryParams.push(`focus=${encodeURIComponent(params.focus)}`);
                }
                if (queryParams.length > 0) {
                    hash += `?${queryParams.join('&')}`;
                }
            }

            window.location.hash = hash;
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
