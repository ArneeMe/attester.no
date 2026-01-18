import {Volunteer} from '@/util/Volunteer'
import {barcodes, image, text} from '@pdfme/schemas';
import {generate} from '@pdfme/generator';
import {customTemplate} from '@/app/pdfinfo/customTemplate';
import {getPdfInput} from "@/app/login/adminpage/getPDFInput";


export const generatePDF = async (volunteer: Volunteer) => {
    const pdfInput = getPdfInput(volunteer);
    try {
        const pdf = await generate({
            template: customTemplate,
            inputs: await pdfInput,
            plugins: {
                text,
                image,
                qrcode: barcodes.qrcode,
            },
        });

        const buffer = new Uint8Array(pdf.buffer);
        const blob = new Blob([buffer], {type: 'application/pdf'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${volunteer.personName}_attest.pdf`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Feil ved generering av PDF:', error);
    }
};