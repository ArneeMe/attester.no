import { NextRequest } from "next/server";
import { apiUrl } from "@/lib/apiUrl";

export const runtime = "edge";

async function forward(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    // A dot segment would let the URL climb out of the API's /v1 root.
    if (path.some((segment) => segment === "." || segment === "..")) {
        return Response.json({ error: "Not found" }, { status: 404 });
    }
    let target: string;
    try {
        target = apiUrl("/" + path.map(encodeURIComponent).join("/"), req.nextUrl.searchParams);
    } catch (e) {
        console.error("api proxy:", (e as Error).message);
        return Response.json({ code: "server_error" }, { status: 502 });
    }
    const headers = new Headers();
    for (const name of ["authorization", "content-type", "accept"]) {
        const value = req.headers.get(name);
        if (value) headers.set(name, value);
    }
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    let upstream: Response;
    try {
        upstream = await fetch(target, {
            method: req.method,
            headers,
            body: hasBody ? await req.arrayBuffer() : undefined,
            cache: "no-store",
        });
    } catch (e) {
        console.error("api proxy:", (e as Error).message);
        return Response.json({ code: "server_error" }, { status: 502 });
    }
    // Answers depend on who asks. Nothing between the API and the browser
    // may keep a copy.
    const out = new Headers({ "cache-control": "no-store" });
    for (const name of ["content-type", "content-disposition"]) {
        const value = upstream.headers.get(name);
        if (value) out.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
