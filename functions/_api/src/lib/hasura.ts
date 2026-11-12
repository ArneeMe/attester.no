import { adminSecret, graphqlUrl } from "../env";

export async function hasuraAdmin<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(graphqlUrl(), {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-hasura-admin-secret": adminSecret(),
        },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
}
