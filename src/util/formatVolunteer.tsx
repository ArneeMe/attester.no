import {Typography} from '@mui/material'
import {Volunteer} from "@/util/Volunteer";
import {formatDate} from "@/util/formatDate";

export const formatVolunteerDetails = (data: Volunteer) => {
    return (
        <>
            <Typography variant="body1">Navn: {data.personName || 'Ingen navn'}</Typography>
            <Typography variant="body1">Rolle: {data.role || 'Ingen rolle'}</Typography>
            <Typography variant="body1">Gruppe: {data.groupName || 'Ingen gruppe'}</Typography>
            <Typography variant="body1">Startdato: {formatDate(data.startDate)}</Typography>
            <Typography variant="body1">Sluttdato: {formatDate(data.endDate)}</Typography>

            {data.extraRole && data.extraRole.length > 0 ? (
                data.extraRole.map((role, index) => {
                    if (role.role && role.groupName && role.startDate && role.endDate) {
                        return (
                            <Typography key={index} variant="body2">
                                {role.role} i {role.groupName} fra {role.startDate} til {role.endDate}
                            </Typography>
                        );
                    }
                    return null;
                })
            ) : (
                <Typography variant="body2" style={{marginTop: '10px'}}>Ingen ekstra roller</Typography>
            )}
        </>
    );

};