export type LandingOrg = {
    /** URL slug — the row links to `/org/<slug>`. */
    slug: string;
    /** Display name as the organisation writes it. */
    name: string;
};

/**
 * Organisations offered by the landing page's picker.
 *
 * PLACEHOLDER — hardcoded on purpose, for now.
 *
 * There is no public endpoint that lists organisations: `/api/org/[slug]`
 * serves one org by slug, and `/api/me/organizations` is authenticated and
 * scoped to the signed-in admin's memberships. Listing every org publicly is
 * a deliberate disclosure decision, so it wants its own endpoint and its own
 * review rather than being smuggled in with a page redesign.
 *
 * Replacing this with live data should be a drop-in: add
 * `GET /api/organizations` returning `{ id, slug, name }` rows ordered by
 * name, then fetch it here. Nothing else in the picker assumes a static list
 * — the count and the scroll behaviour are both derived from its length.
 *
 * Note that `organizations` carries identity only (id, slug, name) and has no
 * active/inactive flag, so "active organisations" means every row.
 */
export const LANDING_ORGS: LandingOrg[] = [
    { slug: 'echo', name: 'echo' },
    { slug: 'brodkokeri', name: 'Brødkokeriet' },
    { slug: 'melbod', name: 'Melbod' },
];
