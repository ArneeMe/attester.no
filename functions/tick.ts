import type { IncomingMessage, ServerResponse } from "node:http";
import { sendResponse, toRequest } from "./_api/src/nodeHost";
import { handleTick } from "./_api/src/jobs/tick";

export default async (req: IncomingMessage, res: ServerResponse) =>
    sendResponse(res, await handleTick(await toRequest(req)));
