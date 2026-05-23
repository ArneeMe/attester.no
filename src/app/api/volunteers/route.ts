import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { requireOrgMemberBySlug, resolveOrgIdBySlug } from "@/lib/server/apiAuth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
    const slug = req.nextUrl.searchParams.get("slug");
    if (!slug) {
        return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const auth = await requireOrgMemberBySlug(req, slug);
    if (auth instanceof NextResponse) return auth;

    try {
        const data = await hasuraAdmin<{
            volunteers: Array<{
                id: string; person_name: string; group_name: string;
                start_date: string; end_date: string; role: string;
                extra_roles: Array<{ groupName: string; startDate: string; endDate: string; role: string }> | null;
            }>;
        }>(
            `query GetVolunteers($organizationId: uuid!) {
                volunteers(
                    where: { organization_id: { _eq: $organizationId } },
                    order_by: { created_at: asc }
                ) {
                    id person_name group_name start_date end_date role extra_roles
                }
            }`,
            { organizationId: auth.organizationId },
        );
        return NextResponse.json({ volunteers: data.volunteers });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { id, slug, personName, groupName, startDate, endDate, role, extraRoles } = await req.json();
    if (!id || !slug || !personName || !groupName || !startDate || !endDate || !role) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
        const organizationId = await resolveOrgIdBySlug(slug);
        if (!organizationId) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const data = await hasuraAdmin<{ insert_volunteers_one: { id: string } }>(
            `mutation InsertVolunteer(
                $id: uuid!, $organizationId: uuid!,
                $personName: String!, $groupName: String!, $startDate: String!,
                $endDate: String!, $role: String!, $extraRoles: jsonb!
            ) {
                insert_volunteers_one(object: {
                    id: $id, organization_id: $organizationId,
                    person_name: $personName, group_name: $groupName,
                    start_date: $startDate, end_date: $endDate,
                    role: $role, extra_roles: $extraRoles
                }) { id }
            }`,
            { id, organizationId, personName, groupName, startDate, endDate, role, extraRoles: extraRoles ?? [] },
        );
        return NextResponse.json({ id: data.insert_volunteers_one.id });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}
