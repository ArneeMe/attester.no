import { Typography } from '@mui/material';
import { formatDate } from '@/util/formatDate';
import type { FormSchema } from '@/types/formSchema';

interface Props {
    schema: FormSchema;
    data: Record<string, string>;
}

const SchemaDetails: React.FC<Props> = ({ schema, data }) => {
    return (
        <>
            {schema.map((field) => {
                const value = data[field.key];
                if (!value && field.optional) return null;
                const display = field.type === 'date' && value ? formatDate(value) : (value || 'Ingen');
                return (
                    <Typography key={field.key} variant="body1">
                        {field.label}: {display}
                    </Typography>
                );
            })}
        </>
    );
};

export default SchemaDetails;
