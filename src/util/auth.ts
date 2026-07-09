import { useEffect, useState } from 'react';
import { nhost, type NhostUser } from '@/lib/nhost';

export const login = async (email: string, password: string): Promise<void> => {
    await nhost.auth.signInEmailPassword({ email, password });
};

export const logout = async (): Promise<void> => {
    const session = nhost.getUserSession();
    await nhost.auth.signOut({ refreshToken: session?.refreshToken });
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
