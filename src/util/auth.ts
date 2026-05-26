import { useEffect, useState } from 'react';
import { nhost, type NhostUser } from '@/lib/nhost';

export const login = async (email: string, password: string): Promise<void> => {
    await nhost.auth.signInEmailPassword({ email, password });
};

export const logout = async (): Promise<void> => {
    const session = nhost.getUserSession();
    await nhost.auth.signOut({ refreshToken: session?.refreshToken });
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
