import { describe, expect, it } from 'vitest';
import { routePattern } from './reportError';

describe('routePattern', () => {
    it('replaces the organisation with a placeholder', () => {
        expect(routePattern('/org/echo')).toBe('/org/:slug');
        expect(routePattern('/org/rode-kors-oslo/verify')).toBe('/org/:slug/verify');
        expect(routePattern('/login/adminpage/echo/maler')).toBe('/login/adminpage/:slug/maler');
    });

    it('never carries the query, which on the verify page is the whole certificate', () => {
        expect(routePattern('/org/echo/verify?name=Ola+Nordmann&id=abc')).toBe('/org/:slug/verify');
        expect(routePattern('/om#kontakt')).toBe('/om');
    });

    it('replaces ids and leaves fixed pages alone', () => {
        expect(routePattern('/x/3f1c2b4a-1111-2222-3333-444455556666/y')).toBe('/x/:id/y');
        expect(routePattern('/')).toBe('/');
        expect(routePattern('/login/adminpage')).toBe('/login/adminpage');
    });
});
