'use client'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authHeader, nhost } from '@/lib/nhost';

export type UserOrg = { id: string; slug: string; name: string; role: string };

export type OrgsStatus = 'loading' | 'ok' | 'unauthenticated' | 'error';

type Ctx = {
    orgs: UserOrg[];
    status: OrgsStatus;
    refresh: () => Promise<void>;
};

const UserOrgsContext = createContext<Ctx | null>(null);

export function UserOrgsProvider({ children }: { children: React.ReactNode }) {
    const [orgs, setOrgs] = useState<UserOrg[]>([]);
    const [status, setStatus] = useState<OrgsStatus>('loading');

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/me/organizations', { headers: authHeader() });
            if (res.status === 401 || res.status === 403) {
                setOrgs([]);
                setStatus('unauthenticated');
                return;
            }
            if (!res.ok) {
                setOrgs([]);
                setStatus('error');
                return;
            }
            const json = await res.json();
            setOrgs(json.organizations ?? []);
            setStatus('ok');
        } catch {
            setOrgs([]);
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        refresh();
        // Re-fetch when the session changes — on first login the access
        // token may not be in storage yet at mount time, so without this
        // the initial refresh() sends no auth header, gets 401, and the
        // user sees "no orgs" until they log out and back in.
        return nhost.sessionStorage.onChange((session) => {
            if (session) {
                refresh();
            } else {
                setOrgs([]);
                setStatus('unauthenticated');
            }
        });
    }, [refresh]);

    return <UserOrgsContext.Provider value={{ orgs, status, refresh }}>{children}</UserOrgsContext.Provider>;
}

export function useUserOrgs(): Ctx {
    const ctx = useContext(UserOrgsContext);
    if (!ctx) throw new Error('useUserOrgs must be used inside <UserOrgsProvider>');
    return ctx;
}

export function useCurrentOrg(slug: string): UserOrg | null | undefined {
    const { orgs, status } = useUserOrgs();
    if (status !== 'ok') return undefined;
    return orgs.find((o) => o.slug === slug) ?? null;
}
