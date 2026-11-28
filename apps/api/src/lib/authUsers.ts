import { hasuraAdmin } from "./hasura";

// Nhost tracks auth.users in Hasura under the root field `users`. We only
// ever read id/email/displayName — never write. User accounts themselves
// are managed by Nhost Auth.

export type AuthUser = { id: string; email: string; displayName: string | null; emailVerified: boolean };

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
    const data = await hasuraAdmin<{ users: AuthUser[] }>(
        `query GetUserByEmail($email: citext!) {
            users(where: { email: { _eq: $email } }, limit: 1) {
                id email displayName emailVerified
            }
        }`,
        { email },
    );
    return data.users[0] ?? null;
}

export async function getUsersByIds(ids: string[]): Promise<AuthUser[]> {
    if (ids.length === 0) return [];
    const data = await hasuraAdmin<{ users: AuthUser[] }>(
        `query GetUsersByIds($ids: [uuid!]!) {
            users(where: { id: { _in: $ids } }) {
                id email displayName emailVerified
            }
        }`,
        { ids },
    );
    return data.users;
}
