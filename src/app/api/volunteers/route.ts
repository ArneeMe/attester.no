import { NextRequest, NextResponse } from "next/server";

const HASURA = `https://${process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN}.hasura.${process.env.NEXT_PUBLIC_NHOST_REGION}.nhost.run`;

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { id, organizationId, personName, groupName, startDate, endDate, role, extraRoles } = body;

    if (!id || !organizationId || !personName || !groupName || !startDate || !endDate || !role) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const res = await fetch(`${HASURA}/v1/graphql`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-hasura-admin-secret": process.env.NHOST_ADMIN_SECRET!,
        },
        body: JSON.stringify({
            query: `
                mutation InsertVolunteer(
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
                }
            `,
            variables: { id, organizationId, personName, groupName, startDate, endDate, role, extraRoles: extraRoles ?? [] },
        }),
    });

    const json = await res.json();
    if (json.errors?.length) {
        return NextResponse.json({ error: json.errors[0].message }, { status: 500 });
    }

    return NextResponse.json({ id: json.data.insert_volunteers_one.id });
}
