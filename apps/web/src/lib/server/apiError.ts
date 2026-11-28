import { NextResponse } from "next/server";

// Hasura's error text names tables, columns, constraints and sometimes the
// offending value. Under this project's privacy model none of that may reach a
// client, least of all the anonymous ones.
//
// The code goes under `code`, not `error`, so the many call sites written as
// `json.error ?? "Kunne ikke laste maler"` keep falling back to their own
// meaningful message instead of rendering a bare token.
export function serverError(e: unknown, context: string): NextResponse {
    console.error(`${context}:`, (e as Error).message);
    return NextResponse.json({ code: "server_error" }, { status: 500 });
}
