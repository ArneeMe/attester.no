import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleApi } from "./app";
import { startScheduler } from "./jobs/scheduled";
import { BodyTooLarge, sendResponse, toRequest } from "./nodeHost";
import { reportError } from "./errors/report";
import { log } from "./lib/log";

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.url === "/healthz") {
        res.statusCode = 200;
        res.end("ok");
        return;
    }
    try {
        await sendResponse(res, await handleApi(await toRequest(req)));
    } catch (e) {
        if (!(e instanceof BodyTooLarge)) reportError(e, "api", "server");
        if (res.headersSent) return res.destroy() as unknown as void;
        res.statusCode = e instanceof BodyTooLarge ? 413 : 500;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(e instanceof BodyTooLarge ? { error: "Request too large" } : { code: "server_error" }));
    }
}

const port = Number(process.env.PORT ?? 8787);
const server = createServer((req, res) => void handle(req, res));
server.listen(port, () => log("info", "listening", { port }));
if (process.env.SCHEDULER !== "off") startScheduler();

for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
