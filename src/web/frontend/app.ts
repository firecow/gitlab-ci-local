import {PipelineList} from "./components/pipeline-list.js";
import {PipelineDetail} from "./components/pipeline-detail.js";

// Simple hash-based router for SPA navigation
class Router {
    private routes: Map<RegExp, (params: any) => void> = new Map();
    private rootElement: HTMLElement;

    constructor (rootElement: HTMLElement) {
        this.rootElement = rootElement;
        this.setupListeners();
    }

    // Register a route with pattern and handler
    register (pattern: string, handler: (params: any) => void) {
        const paramNames: string[] = [];
        const regexPattern = pattern
            .replace(/:[^\s/]+/g, (match) => {
                paramNames.push(match.slice(1));
                return "([^/]+)";
            });
        const regex = new RegExp(`^${regexPattern}$`);
        this.routes.set(regex, (path: string) => {
            const match = path.match(regex);
            if (match) {
                const params: any = {};
                paramNames.forEach((name, i) => {
                    params[name] = match[i + 1];
                });
                handler(params);
            }
        });
    }

    // Navigate to a new route
    navigate (path: string) {
        window.location.hash = path;
    }

    // Setup hash change listener
    private setupListeners () {
        window.addEventListener("hashchange", () => this.handleRoute());
        this.handleRoute();
    }

    // Handle current route
    private handleRoute () {
        const hash = window.location.hash.slice(1) || "/";

        for (const [regex, handler] of this.routes) {
            if (regex.test(hash)) {
                handler(hash);
                return;
            }
        }

        // Default route
        this.navigate("/");
    }

    // Clear root element
    clear () {
        this.rootElement.innerHTML = "";
    }

    // Render component into root
    render (component: HTMLElement) {
        this.clear();
        this.rootElement.appendChild(component);
    }
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    const rootElement = document.getElementById("app-root");
    if (!rootElement) {
        console.error("App root element not found");
        return;
    }

    const router = new Router(rootElement);

    // Register routes
    router.register("/", () => {
        const pipelineList = new PipelineList(router);
        router.render(pipelineList);
    });

    router.register("/pipelines", () => {
        const pipelineList = new PipelineList(router);
        router.render(pipelineList);
    });

    router.register("/pipelines/:id", (params: any) => {
        const pipelineDetail = new PipelineDetail(router, params.id);
        router.render(pipelineDetail);
    });
});
