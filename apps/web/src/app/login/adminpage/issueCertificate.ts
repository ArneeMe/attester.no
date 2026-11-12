import { authHeader } from '@/lib/nhost';

type RenderedPdf = { blob: Blob; filename: string; verifyUrl: string };

const post = async (orgSlug: string, submissionId: string, action: 'issue' | 'preview') => {
    const res = await fetch(
        `/api/v1/org/${encodeURIComponent(orgSlug)}/submissions/${encodeURIComponent(submissionId)}/${action}`,
        { method: 'POST', headers: authHeader() },
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Server error');
    return json as { pdf: string; filename: string; verifyUrl: string; alreadyIssued?: boolean };
};

const toBlob = (base64: string): Blob => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: 'application/pdf' });
};

export const issueCertificate = async (orgSlug: string, submissionId: string): Promise<RenderedPdf> => {
    const json = await post(orgSlug, submissionId, 'issue');
    return { blob: toBlob(json.pdf), filename: json.filename, verifyUrl: json.verifyUrl };
};

export const downloadBlob = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const previewCertificate = async (orgSlug: string, submissionId: string) => {
    const json = await post(orgSlug, submissionId, 'preview');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(toBlob(json.pdf));
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
