import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    serverTimestamp,
    query,
    where,
} from 'firebase/firestore';
import { db } from '@/app/firebase/fb_config';
import type { PDFTemplate, TemplateField } from '@/types/templateTypes';
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
            fields: data.fields ? JSON.parse(data.fields) : undefined,
            isDefault: data.isDefault,
            status: data.status || 'draft',
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as PDFTemplate;
    });
}


export async function getActiveTemplates(): Promise<PDFTemplate[]> {
    const orgId = getActiveOrgId();
    const templatesRef = collection(db, 'organizations', orgId, 'templates');
    const q = query(templatesRef, where('status', '==', 'active'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            organizationId: data.organizationId,
            name: data.name,
            description: data.description,
            basePdf: data.basePdf,
            schemas: JSON.parse(data.schemas),
            fields: data.fields ? JSON.parse(data.fields) : undefined,
            isDefault: data.isDefault,
            status: data.status,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as PDFTemplate;
    });
}

export async function getTemplateById(templateId: string): Promise<PDFTemplate | null> {
    const orgId = getActiveOrgId();
    const docRef = doc(db, 'organizations', orgId, 'templates', templateId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        return null;
    }

    const data = docSnap.data();
    return {
        id: docSnap.id,
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        basePdf: data.basePdf,
        schemas: JSON.parse(data.schemas),
        fields: data.fields ? JSON.parse(data.fields) : undefined,
        isDefault: data.isDefault,
        status: data.status || 'draft',
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
    } as PDFTemplate;
}

export async function saveTemplate(
    template: Omit<PDFTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PDFTemplate> {
    const orgId = getActiveOrgId();
    const templatesRef = collection(db, 'organizations', orgId, 'templates');

    const docData = {
        ...template,
        schemas: JSON.stringify(template.schemas),
        fields: template.fields ? JSON.stringify(template.fields) : null,
        status: template.status || 'draft',
        organizationId: orgId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(templatesRef, docData);

    return {
        ...template,
        id: docRef.id,
        status: template.status || 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}


export async function updateTemplateFields(
    templateId: string,
    fields: TemplateField[]
): Promise<void> {
    const orgId = getActiveOrgId();
    const docRef = doc(db, 'organizations', orgId, 'templates', templateId);

    await updateDoc(docRef, {
        fields: JSON.stringify(fields),
        updatedAt: serverTimestamp(),
    });
}


export async function updateTemplateStatus(
    templateId: string,
    status: 'draft' | 'active'
): Promise<void> {
    const orgId = getActiveOrgId();
    const docRef = doc(db, 'organizations', orgId, 'templates', templateId);

    await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp(),
    });
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
        status: 'draft',
    };
}