'use client'
import React from 'react';
import Link from 'next/link';
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import { useUserOrgs } from './UserOrgsProvider';
import { useAdminLang } from '@/util/useAdminLang';

const AdminOrgPicker: React.FC = () => {
    const { orgs, status } = useUserOrgs();
    const { strings } = useAdminLang();
    const a = strings.admin.picker;

    if (status === 'loading') {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                {a.title}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                {orgs.map((org) => (
                    <Paper key={org.id} sx={{ p: 2 }}>
                        <Button
                            component={Link}
                            href={`/login/adminpage/${org.slug}`}
                            variant="contained"
                            fullWidth
                        >
                            {org.name} ({org.slug})
                        </Button>
                    </Paper>
                ))}
                {orgs.length === 0 && (
                    <Paper sx={{ p: 3 }}>
                        <Typography>
                            {a.empty}
                        </Typography>
                    </Paper>
                )}
            </Box>
        </Box>
    );
};

export default AdminOrgPicker;
