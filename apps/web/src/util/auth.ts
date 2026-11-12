import { useCallback, useEffect, useState } from 'react';
import { authHeader, nhost, type NhostUser } from '@/lib/nhost';

// Must match the Nhost project's "Minimum password length"
// (Settings → Sign-In Methods → Email and Password).
export const PASSWORD_MIN_LENGTH = 10;

export const login = async (email: string, password: string): Promise<void> => {
    await nhost.auth.signInEmailPassword({ email, password });
};

// A fresh account has no org memberships, so signing up grants no access.
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

// Changing the password revokes every session, including the one established
// here, so the user has to sign in again afterwards.
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
        // Nhost writes the session to storage after signInEmailPassword
        // resolves, so a read on mount alone races with login.
        setUser(nhost.getUserSession()?.user ?? null);
        return nhost.sessionStorage.onChange((session) => {
            setUser(session?.user ?? null);
        });
    }, []);
    return user;
};

const REFRESH_MARGIN_SECONDS = 300;
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

// The SDK refreshes only on its own HTTP clients, and the admin area builds
// its own auth header, so without this nothing refreshes the token.
export function useSessionKeepAlive(): boolean {
    const [expired, setExpired] = useState(false);

    const tick = useCallback(async () => {
        if (!nhost.getUserSession()) return;
        const session = await nhost.refreshSession(REFRESH_MARGIN_SECONDS);
        // null also means the endpoint was unreachable; only a session the
        // SDK discarded proves the refresh token is dead.
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
