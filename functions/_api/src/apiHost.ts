import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApi } from "./app";
import { sendResponse, toRequest } from "./nodeHost";

export async function nodeHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    await sendResponse(res, await handleApi(await toRequest(req)));
}
