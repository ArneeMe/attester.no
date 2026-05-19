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
        setUser(nhost.getUserSession()?.user ?? null);
    }, []);
    return user;
};
