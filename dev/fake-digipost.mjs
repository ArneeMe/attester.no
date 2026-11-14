// A stand-in for Digipost in the local test rig. It checks every request's
// signature with the sender's public key, exactly as Digipost does, so a
// signing mistake fails here and not in production. It keeps the letters it
// receives in memory and shows them at http://localhost:8090/.
//
// Who "has Digipost" here: a fødselsnummer whose day of birth is 01.
import { createServer } from 'node:http';
import { createHash, createPublicKey, createVerify } from 'node:crypto';

const NS = 'http://api.digipost.no/schema/v8';
const TYPE = 'application/vnd.digipost-v8+xml';
const publicKey = createPublicKey(Buffer.from(process.env.DIGIPOST_PUBLIC_KEY ?? '', 'base64').toString('utf8'));
const letters = [];
const seenMessageIds = new Set();

const xml = (res, status, body) => {
    res.writeHead(status, { 'content-type': TYPE });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>${body}`);
};
const error = (res, status, code) =>
    xml(res, status, `<error xmlns="${NS}"><error-code>${code}</error-code><error-message>${code}</error-message><error-type>CLIENT_DATA</error-type></error>`);
const tag = (text, name) => new RegExp(`<${name}[^>]*>([^<]*)</${name}>`).exec(text)?.[1] ?? null;

function signatureOk(req, path, query, body) {
    const sha = req.headers['x-content-sha256'];
    if (body.length > 0 && sha !== createHash('sha256').update(body).digest('base64')) return false;
    const signed =
        `${req.method}\n${path.toLowerCase()}\ndate: ${req.headers.date}\n`
        + (sha ? `x-content-sha256: ${sha}\n` : '')
        + `x-digipost-userid: ${req.headers['x-digipost-userid']}\n${query.toLowerCase()}\n`;
    try {
        return createVerify('RSA-SHA256').update(signed).verify(publicKey, String(req.headers['x-digipost-signature']), 'base64');
    } catch {
        return false;
    }
}

createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
        const body = Buffer.concat(chunks);
        const [path, query = ''] = (req.url ?? '/').split('?');

        if (path === '/healthz') return res.end('ok');
        if (path === '/letters') {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify(letters.map(({ pdf, ...rest }) => ({ ...rest, pdfBytes: pdf.length }))));
        }
        const pdfMatch = /^\/letters\/(\d+)\.pdf$/.exec(path);
        if (pdfMatch && letters[Number(pdfMatch[1])]) {
            res.writeHead(200, { 'content-type': 'application/pdf' });
            return res.end(letters[Number(pdfMatch[1])].pdf);
        }
        if (path === '/' && !req.headers['x-digipost-signature']) {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(
                `<h1>Liksom-Digipost</h1><p>${letters.length} brev mottatt.</p><ul>`
                + letters.map((l, i) => `<li><a href="/letters/${i}.pdf">${l.subject}</a> til ${l.recipient}, ${l.receivedAt}</li>`).join('')
                + '</ul>',
            );
        }

        if (!signatureOk(req, path, query, body)) return error(res, 401, 'INVALID_SIGNATURE');

        if (req.method === 'GET' && path === '/') {
            return xml(res, 200,
                `<entrypoint xmlns="${NS}">`
                + `<link rel="http://digipost:8090/relations/create_message" uri="http://digipost:8090/messages" media-type="${TYPE}"/>`
                + `<link rel="http://digipost:8090/relations/identify_recipient" uri="http://digipost:8090/identification" media-type="${TYPE}"/>`
                + `</entrypoint>`);
        }
        if (req.method === 'POST' && path === '/identification') {
            const id = tag(body.toString('utf8'), 'personal-identification-number') ?? '';
            const result = !/^\d{11}$/.test(id) ? 'INVALID' : id.startsWith('01') ? 'DIGIPOST' : 'IDENTIFIED';
            return xml(res, 200, `<identification-result xmlns="${NS}"><result>${result}</result></identification-result>`);
        }
        if (req.method === 'POST' && path === '/messages') {
            const boundary = /boundary=(.+)$/.exec(req.headers['content-type'] ?? '')?.[1];
            if (!boundary) return error(res, 400, 'PROBLEM_WITH_REQUEST');
            const parts = body.toString('latin1').split(`--${boundary}`);
            const message = Buffer.from(parts[1]?.slice(parts[1].indexOf('\r\n\r\n') + 4, -2) ?? '', 'latin1').toString('utf8');
            const pdf = Buffer.from(parts[2]?.slice(parts[2].indexOf('\r\n\r\n') + 4, -2) ?? '', 'latin1');
            const messageId = tag(message, 'message-id');
            const recipient = tag(message, 'personal-identification-number') ?? '';
            if (!messageId || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) return error(res, 400, 'PROBLEM_WITH_REQUEST');
            if (seenMessageIds.has(messageId)) return error(res, 409, 'DUPLICATE_MESSAGE');
            if (!recipient.startsWith('01')) return error(res, 404, 'UNKNOWN_RECIPIENT');
            seenMessageIds.add(messageId);
            letters.push({ messageId, recipient, subject: tag(message, 'subject') ?? '', receivedAt: new Date().toISOString(), pdf });
            return xml(res, 200,
                `<message-delivery xmlns="${NS}"><message-id>${messageId}</message-id><delivery-method>DIGIPOST</delivery-method>`
                + `<sender-id>${req.headers['x-digipost-userid']}</sender-id><status>DELIVERED</status></message-delivery>`);
        }
        return error(res, 404, 'NOT_FOUND');
    });
}).listen(8090, () => console.log('fake digipost on 8090'));
