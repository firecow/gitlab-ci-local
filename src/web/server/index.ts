import http from "http";
import path from "path";
import {EventEmitter} from "../events/event-emitter.js";
import {EventRecorder} from "../events/event-recorder.js";
import {EventBroadcaster} from "../events/event-broadcaster.js";
import {GCLDatabase} from "../persistence/database.js";
import {APIRouter} from "./api-router.js";
import {SSEManager} from "./sse-manager.js";
import {StaticServer} from "./static-server.js";

export interface WebServerOptions {
    port: number;
    cwd: string;
    stateDir: string;
    dbPath?: string;
    mountCwd?: boolean;
    volumes?: string[];
    helperImage?: string;
}

export class WebServer {
    private server: http.Server;
    private db: GCLDatabase;
    private sseManager: SSEManager;
    private eventRecorder: EventRecorder;
    private eventBroadcaster: EventBroadcaster;
    private apiRouter: APIRouter;
    private staticServer: StaticServer;
    private options: WebServerOptions;

    constructor (options: WebServerOptions) {
        this.options = options;

        // Initialize database
        const dbPath = options.dbPath || path.join(options.cwd, options.stateDir, "web-ui.db");
        this.db = new GCLDatabase(dbPath);

        // Initialize SSE manager
        this.sseManager = new SSEManager();

        // Initialize event system
        this.eventRecorder = new EventRecorder(this.db);
        this.eventBroadcaster = new EventBroadcaster(this.sseManager);

        // Initialize API router
        this.apiRouter = new APIRouter(this.db, options.cwd, options.stateDir, options.mountCwd, options.volumes, options.helperImage);

        // Initialize static server (uses embedded HTML, no external files needed)
        this.staticServer = new StaticServer();

        // Create HTTP server
        this.server = http.createServer(this.handleRequest.bind(this));

        // Enable event emission
        EventEmitter.getInstance().enable();
    }

    private handleRequest (req: http.IncomingMessage, res: http.ServerResponse) {
        const url = req.url || "/";

        // Handle SSE connections
        if (url.startsWith("/events/")) {
            this.sseManager.handleConnection(req, res);
            return;
        }

        // Handle API requests
        if (url.startsWith("/api/")) {
            this.apiRouter.handle(req, res);
            return;
        }

        // Serve static files
        this.staticServer.serve(req, res);
    }

    async start (): Promise<void> {
        // Initialize database (sql.js requires async init)
        await this.db.init();

        // Mark any incomplete pipelines/jobs from previous runs as cancelled
        const cancelled = this.db.markIncompleteAsCancelled();
        if (cancelled.pipelines > 0 || cancelled.jobs > 0) {
            console.log(`Cleaned up ${cancelled.pipelines} incomplete pipeline(s) and ${cancelled.jobs} job(s) from previous run`);
        }

        return new Promise<void>((resolve, reject) => {
            this.server.on("error", reject);
            this.server.listen(this.options.port, () => {
                console.log(`\nWeb UI available at http://localhost:${this.options.port}`);
                console.log(`Monitoring pipelines in ${this.options.cwd}\n`);
                resolve();
            });
        });
    }

    async stop (): Promise<void> {
        // Cleanup
        this.eventRecorder.cleanup();
        this.sseManager.closeAll();
        this.db.close();

        return new Promise<void>((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    getConnectionCount (): number {
        return this.sseManager.getConnectionCount();
    }

    getStats () {
        return {
            ...this.db.getStats(),
            connections: this.sseManager.getConnectionCount(),
        };
    }
}
