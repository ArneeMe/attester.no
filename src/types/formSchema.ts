export type FormFieldSchema = {
    key: string;
    label: string;
    type: 'text' | 'date';
    optional?: boolean;
};

export type FormSchema = FormFieldSchema[];

/**
 * The default form schema matches the hardcoded Volunteer shape. Backfilled
 * onto every existing template via DB migration; new templates inherit this
 * via the DB column DEFAULT until PR 2 introduces a template-aware form.
 */
export const VOLUNTEER_FORM_SCHEMA: FormSchema = [
    { key: 'name', label: 'Navn', type: 'text' },
    { key: 'group', label: 'Gruppe', type: 'text' },
    { key: 'start', label: 'Startdato', type: 'date' },
    { key: 'end', label: 'Sluttdato', type: 'date' },
    { key: 'role', label: 'Rolle', type: 'text' },
    { key: 'group1', label: 'Gruppe 1', type: 'text', optional: true },
    { key: 'start1', label: 'Startdato 1', type: 'date', optional: true },
    { key: 'end1', label: 'Sluttdato 1', type: 'date', optional: true },
    { key: 'role1', label: 'Rolle 1', type: 'text', optional: true },
    { key: 'group2', label: 'Gruppe 2', type: 'text', optional: true },
    { key: 'start2', label: 'Startdato 2', type: 'date', optional: true },
    { key: 'end2', label: 'Sluttdato 2', type: 'date', optional: true },
    { key: 'role2', label: 'Rolle 2', type: 'text', optional: true },
    { key: 'group3', label: 'Gruppe 3', type: 'text', optional: true },
    { key: 'start3', label: 'Startdato 3', type: 'date', optional: true },
    { key: 'end3', label: 'Sluttdato 3', type: 'date', optional: true },
    { key: 'role3', label: 'Rolle 3', type: 'text', optional: true },
];
