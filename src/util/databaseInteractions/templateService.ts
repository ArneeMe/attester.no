import {
    collection,
    getDocs,
    addDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/app/firebase/fb_config';
import type { PDFTemplate } from '@/types/templateTypes';
import type { Template } from '@pdfme/common';

export function getActiveOrgId(): string {
    return 'echo-org';
}

export async function getTemplates(): Promise<PDFTemplate[]> {
    const orgId = getActiveOrgId();
    const templatesRef = collection(db, 'organizations', orgId, 'templates');
    const snapshot = await getDocs(templatesRef);

    return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            organizationId: data.organizationId,
            name: data.name,
            description: data.description,
            basePdf: data.basePdf,
            schemas: JSON.parse(data.schemas),
            isDefault: data.isDefault,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as PDFTemplate;
    });
}

export async function saveTemplate(
    template: Omit<PDFTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PDFTemplate> {
    const orgId = getActiveOrgId();
    const templatesRef = collection(db, 'organizations', orgId, 'templates');

    const docData = {
        ...template,
        schemas: JSON.stringify(template.schemas),
        organizationId: orgId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(templatesRef, docData);

    return {
        ...template,
        id: docRef.id,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

export function fromPdfmeTemplate(
    pdfmeTemplate: Template,
    name: string,
    options?: { description?: string; isDefault?: boolean }
): Omit<PDFTemplate, 'id' | 'createdAt' | 'updatedAt'> {
    return {
        organizationId: getActiveOrgId(),
        name,
        description: options?.description,
        basePdf: pdfmeTemplate.basePdf as string,
        schemas: pdfmeTemplate.schemas,
        isDefault: options?.isDefault ?? false,
    };
}