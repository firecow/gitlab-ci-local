import http from "http";
import {INDEX_HTML} from "../frontend/embedded.js";

// Serves the embedded frontend HTML - no external files needed
export class StaticServer {
    async serve (_req: http.IncomingMessage, res: http.ServerResponse) {
        // Serve embedded HTML for all requests (SPA)
        res.writeHead(200, {
            "Content-Type": "text/html",
            "Content-Length": Buffer.byteLength(INDEX_HTML),
            "Cache-Control": "no-cache",
        });
        res.end(INDEX_HTML);
    }
}
