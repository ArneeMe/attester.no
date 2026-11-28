import { json } from "../http";
import { reportError } from "../errors/report";
import { requestContext } from "./requestContext";

// Hasura's error text names tables, columns, constraints and sometimes the
// offending value. Under this project's privacy model none of that may reach a
// client, least of all the anonymous ones.
//
// The code goes under `code`, not `error`, so the many call sites written as
// `json.error ?? "Kunne ikke laste maler"` keep falling back to their own
// meaningful message instead of rendering a bare token.
//
// `requestId` is the one thing the caller gets: a random id they can quote,
// which finds the error in the log and says nothing about them.
export function serverError(e: unknown, context: string): Response {
    reportError(e, "api", requestContext()?.route ?? context);
    return json({ code: "server_error", requestId: requestContext()?.id }, { status: 500 });
}
