import { useCallback, useEffect, useState } from 'react';
import { authHeader, nhost, type NhostUser } from '@/lib/nhost';

// Must match the Nhost project's "Minimum password length" setting
// (Settings → Sign-In Methods → Email and Password). Checked client-side
// too, so a too-short password gets a clear inline message instead of
// whatever raw error Nhost's API returns.
export const PASSWORD_MIN_LENGTH = 10;

export const login = async (email: string, password: string): Promise<void> => {
    await nhost.auth.signInEmailPassword({ email, password });
};

/**
 * Self-signup. A fresh account carries zero org memberships, so it grants
 * no access by itself — an existing member must add the address via the
 * Medlemmer page. Returns true if a session was established immediately,
 * false when Nhost requires email verification first.
 */
export const signup = async (
    email: string,
    password: string,
    displayName: string,
): Promise<boolean> => {
    const res = await nhost.auth.signUpEmailPassword({
        email,
        password,
        options: displayName ? { displayName } : undefined,
    });
    return !!res.body?.session;
};

export const logout = async (): Promise<void> => {
    const session = nhost.getUserSession();
    await nhost.auth.signOut({ refreshToken: session?.refreshToken });
};

/**
 * Redeem an org invite token for the logged-in user. Returns the org name
 * on success; throws with the server's message otherwise. Callable right
 * after signup/login once the session is established.
 */
export const redeemInvite = async (token: string): Promise<string> => {
    const res = await fetch('/api/invites/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeader() },
        body: JSON.stringify({ token }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Server error');
    return json.organization?.name ?? '';
};

export const requestPasswordReset = async (email: string): Promise<void> => {
    await nhost.auth.sendPasswordResetEmail({
        email,
        options: { redirectTo: `${window.location.origin}/login/reset` },
    });
};

/**
 * Completes the email reset flow: the link from Nhost redirects here with a
 * refreshToken in the URL; exchanging it establishes a session, and the
 * password change then revokes every session (including this one), so the
 * user must sign in again with the new password.
 */
export const completePasswordReset = async (
    refreshToken: string,
    newPassword: string,
): Promise<void> => {
    await nhost.auth.refreshToken({ refreshToken });
    await nhost.auth.changeUserPassword({ newPassword });
    nhost.clearSession();
};

export const useAuth = (): NhostUser | null | undefined => {
    const [user, setUser] = useState<NhostUser | null | undefined>(undefined);
    useEffect(() => {
        // Read once synchronously, then subscribe — Nhost's client-side
        // middleware updates session storage *after* signInEmailPassword
        // resolves, so a one-shot read on mount races with login.
        setUser(nhost.getUserSession()?.user ?? null);
        return nhost.sessionStorage.onChange((session) => {
            setUser(session?.user ?? null);
        });
    }, []);
    return user;
};

const REFRESH_MARGIN_SECONDS = 300;
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

// Nhost's SDK refreshes tokens through its own HTTP clients, but the admin
// area talks to our API routes with a hand-built header, so that middleware
// never runs and the access token just goes stale.
export function useSessionKeepAlive(): boolean {
    const [expired, setExpired] = useState(false);

    const tick = useCallback(async () => {
        if (!nhost.getUserSession()) return;
        const session = await nhost.refreshSession(REFRESH_MARGIN_SECONDS);
        // A null result also covers the auth endpoint being briefly
        // unreachable, so only a session the SDK itself discarded proves the
        // refresh token is dead. Anything else retries on the next tick.
        if (!session && !nhost.getUserSession()) setExpired(true);
    }, []);

    useEffect(() => {
        void tick();
        const timer = setInterval(() => void tick(), REFRESH_INTERVAL_MS);
        const onVisibility = () => {
            if (document.visibilityState === 'visible') void tick();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [tick]);

    return expired;
}
