import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { HubSnippet } from '../../../Modules/Hub/Models';

const SHORT_ID_PATTERN = /^[a-f0-9]{10}$/i;

function normalizeShortId(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
}

const LANGUAGE_TO_EXTENSION: Record<string, string> = {
    bash: 'sh',
    shell: 'sh',
    zsh: 'sh',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    css: 'css',
    dart: 'dart',
    dockerfile: 'Dockerfile',
    go: 'go',
    graphql: 'graphql',
    html: 'html',
    java: 'java',
    javascript: 'js',
    json: 'json',
    kotlin: 'kt',
    lua: 'lua',
    markdown: 'md',
    php: 'php',
    plaintext: 'txt',
    python: 'py',
    r: 'r',
    ruby: 'rb',
    rust: 'rs',
    scala: 'scala',
    sql: 'sql',
    swift: 'swift',
    toml: 'toml',
    typescript: 'ts',
    xml: 'xml',
    yaml: 'yaml',
};

function cleanFileName(value: string): string {
    const normalized = value
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120);

    return normalized || 'snippet';
}

function getFileExtension(language: string): string {
    const normalized = (language || '').toLowerCase().trim();
    return LANGUAGE_TO_EXTENSION[normalized] || 'txt';
}

function getPasswordFromRequest(req: Request): string {
    const headerValue = req.headers['x-snippet-password'];
    if (typeof headerValue === 'string' && headerValue.trim()) return headerValue.trim();
    if (Array.isArray(headerValue) && typeof headerValue[0] === 'string' && headerValue[0].trim()) {
        return headerValue[0].trim();
    }

    const queryValue = req.query?.password;
    if (typeof queryValue === 'string' && queryValue.trim()) return queryValue.trim();

    return '';
}

function getRequestToken(req: Request): string {
    const auth = typeof req.headers.authorization === 'string'
        ? req.headers.authorization.trim()
        : '';
    if (auth.toLowerCase().startsWith('bearer ')) {
        const token = auth.slice(7).trim();
        if (token) return token;
    }

    const cookieToken = typeof (req as any).cookies?.hub_token === 'string'
        ? (req as any).cookies.hub_token.trim()
        : '';

    return cookieToken;
}

function getAuthenticatedUserId(req: Request): string {
    const token = getRequestToken(req);
    if (!token) return '';

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as {
            userId?: string;
            sub?: string;
        };
        return (decoded.userId || decoded.sub || '').trim();
    } catch {
        return '';
    }
}

export default {
    name: 'Hub Download Snippet',
    path: '/hub/snippets/:id/download',
    method: 'get',
    category: 'hub',
    execution: async (req: Request, res: Response) => {
        const id = normalizeShortId(req.params?.id);
        if (!SHORT_ID_PATTERN.test(id)) {
            return res.status(400).json({ status: false, msg: 'ID de snippet inválido' });
        }

        const password = getPasswordFromRequest(req);

        const snippet = await HubSnippet.findOne({ shortId: id });
        if (!snippet) {
            return res.status(404).json({ status: false, msg: 'Snippet no encontrado' });
        }

        if ((snippet as any).allowDownload === false) {
            return res.status(403).json({ status: false, msg: 'La descarga está deshabilitada para este snippet' });
        }

        if (snippet.passwordHash) {
            const authUserId = getAuthenticatedUserId(req);
            const ownerId = String((snippet as any).userId || '').trim();
            const isOwner = ownerId.length > 0 && ownerId === authUserId;

            if (!isOwner && !password) {
                return res.status(401).json({ status: false, requiresPassword: true, msg: 'Contraseña requerida' });
            }

            if (!isOwner) {
                const match = await bcrypt.compare(password, snippet.passwordHash);
                if (!match) {
                    return res.status(401).json({ status: false, msg: 'Contraseña incorrecta' });
                }
            }
        }

        const ext = getFileExtension(snippet.language || 'plaintext');
        const baseName = cleanFileName(snippet.title || `snippet-${snippet.shortId}`);
        const filename = ext === 'Dockerfile' ? 'Dockerfile' : `${baseName}.${ext}`;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(snippet.code || '');
    },
};
