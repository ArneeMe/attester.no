import { NextRequest, NextResponse } from "next/server";
import { hasuraAdmin } from "@/lib/server/hasura";
import { isValidJwt } from "@/lib/server/auth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
    if (!isValidJwt(req.headers.get("authorization"))) {
        return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    try {
        const data = await hasuraAdmin<{
            volunteers: Array<{
                id: string; person_name: string; group_name: string;
                start_date: string; end_date: string; role: string;
                extra_roles: Array<{ groupName: string; startDate: string; endDate: string; role: string }> | null;
            }>;
        }>(
            `query GetVolunteers {
                volunteers(order_by: { created_at: asc }) {
                    id person_name group_name start_date end_date role extra_roles
                }
            }`,
        );
        return NextResponse.json({ volunteers: data.volunteers });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const { id, organizationId, personName, groupName, startDate, endDate, role, extraRoles } = await req.json();
    if (!id || !organizationId || !personName || !groupName || !startDate || !endDate || !role) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
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
