'use client'
import { useEffect, useState } from 'react';
import { getStrings, normalizeLang, type Lang, type Strings } from '@/strings';

const STORAGE_KEY = 'attester-admin-lang';

/**
 * Admin-surface language, persisted in localStorage (the admin app is a
 * logged-in SPA-ish surface where URL-based lang would have to be threaded
 * through every nav link). Defaults to Norwegian; SSR renders Norwegian and
 * the client corrects after hydration.
 */
export function useAdminLang(): {
    lang: Lang;
    setLang: (l: Lang) => void;
    strings: Strings;
} {
    const [lang, setLangState] = useState<Lang>('no');

    useEffect(() => {
        try {
            setLangState(normalizeLang(window.localStorage.getItem(STORAGE_KEY)));
        } catch { /* storage unavailable → stay Norwegian */ }
    }, []);

    const setLang = (l: Lang) => {
        setLangState(l);
        try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
    };

    return { lang, setLang, strings: getStrings(lang) };
}
