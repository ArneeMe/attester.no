import { describe, it, expect } from 'vitest';
import { selectHashFields } from './verifyFieldSelection';
import type { FormSchema } from '@/types/formSchema';

const schema: FormSchema = [
    { key: 'name', label: 'Navn', type: 'text' },
    { key: 'group', label: 'Gruppe', type: 'text' },
];

describe('selectHashFields', () => {
    it('without a schema, trusts every field as-is', () => {
        const fields = { id: 's1', name: 'Ola', utm_source: 'facebook' };
        expect(selectHashFields(null, fields)).toEqual(fields);
    });

    it('with a schema, keeps id plus known schema keys', () => {
        const fields = { id: 's1', name: 'Ola', group: 'Webkom' };
        expect(selectHashFields(schema, fields)).toEqual(fields);
    });

    it('with a schema, drops a tracking param picked up when the link was shared', () => {
        // Messaging apps and social platforms commonly append params like
        // fbclid/utm_source to shared links — these must never reach the hash.
        const fields = { id: 's1', name: 'Ola', fbclid: 'abc123' };
        expect(selectHashFields(schema, fields)).toEqual({ id: 's1', name: 'Ola' });
    });

    it('with a schema, drops any key the schema does not declare — even lang', () => {
        const fields = { id: 's1', name: 'Ola', lang: 'en' };
        expect(selectHashFields(schema, fields)).toEqual({ id: 's1', name: 'Ola' });
    });

    it('with a schema, drops a field-looking key that is not part of THIS schema', () => {
        const fields = { id: 's1', name: 'Ola', role: 'Boss' }; // role not declared here
        expect(selectHashFields(schema, fields)).toEqual({ id: 's1', name: 'Ola' });
    });
});
