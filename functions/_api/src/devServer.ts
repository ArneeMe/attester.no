import { createServer } from "node:http";
import { nodeHandler } from "./nodeHost";

const port = Number(process.env.PORT ?? 8787);

createServer((req, res) => {
    nodeHandler(req, res).catch((e) => {
        console.error("dev server:", (e as Error).message);
        res.statusCode = 500;
        res.end();
    });
}).listen(port, () => console.log(`attester api on http://localhost:${port}`));
