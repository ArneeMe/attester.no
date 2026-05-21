'use client'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authHeader } from '@/lib/nhost';

export type UserOrg = { id: string; slug: string; name: string; role: string };

type Ctx = {
    orgs: UserOrg[] | null; // null = still loading
    refresh: () => Promise<void>;
};

const UserOrgsContext = createContext<Ctx | null>(null);

export function UserOrgsProvider({ children }: { children: React.ReactNode }) {
    const [orgs, setOrgs] = useState<UserOrg[] | null>(null);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/me/organizations', { headers: authHeader() });
            if (!res.ok) {
                setOrgs([]);
                return;
            }
            const json = await res.json();
            setOrgs(json.organizations ?? []);
        } catch {
            setOrgs([]);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return <UserOrgsContext.Provider value={{ orgs, refresh }}>{children}</UserOrgsContext.Provider>;
}

export function useUserOrgs(): Ctx {
    const ctx = useContext(UserOrgsContext);
    if (!ctx) throw new Error('useUserOrgs must be used inside <UserOrgsProvider>');
    return ctx;
}

/**
 * Returns the membership for the given slug, or:
 *   - undefined while memberships are still loading
 *   - null if the caller doesn't belong to the org
 */
export function useCurrentOrg(slug: string): UserOrg | null | undefined {
    const { orgs } = useUserOrgs();
    if (orgs === null) return undefined;
    return orgs.find((o) => o.slug === slug) ?? null;
}
