import type { IncomingMessage, ServerResponse } from "node:http";
import { nodeHandler } from "./_api/src/apiHost";

export default (req: IncomingMessage, res: ServerResponse) => nodeHandler(req, res);
