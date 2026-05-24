/**
 * LEGACY — kept as a record of the pre-multi-org positional URL contract used
 * by echo's printed certificates. Not called at issuance anymore.
 * See CLAUDE.md "The legacy /verify route" — keep until ~2030.
 *
 * The Volunteer shape below is the exact shape this function was originally
 * called with. Inlined here so this file is self-contained when the new flow
 * removes Volunteer.ts.
 */
type LegacyExtraRole = {
    groupName: string;
    startDate: string;
    endDate: string;
    role: string;
};

type LegacyVolunteer = {
    id: string;
    personName: string;
    groupName: string;
    startDate: string;
    endDate: string;
    role: string;
    extraRole?: LegacyExtraRole[];
};

export const generateParams = (formData: LegacyVolunteer): string => {
    const { id, personName, groupName, startDate, endDate, role, extraRole } = formData;
    let params = `${id}_${personName}_${groupName}_${startDate}_${endDate}_${role}`;
    if (extraRole && extraRole.length > 0) {
        const extraRolesParams = extraRole.map((r) => {
            return `${r.groupName}_${r.startDate}_${r.endDate}_${r.role}`;
        }).join('_');
        params += `_${extraRolesParams}`;
    }
    return params;
};
