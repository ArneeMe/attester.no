import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

// What a log line or an error report may know about the request it belongs
// to. The route is the pattern ("/org/:slug/submissions"), never the path, so
// no slug or id gets in. Nothing here identifies the caller.
export type RequestContext = { id: string; method: string; route: string };

const storage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(method: string, run: () => Promise<T>): Promise<T> {
    return storage.run({ id: randomUUID(), method, route: "unmatched" }, run);
}

export function requestContext(): RequestContext | undefined {
    return storage.getStore();
}
