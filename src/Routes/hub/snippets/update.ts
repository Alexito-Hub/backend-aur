import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { HubSnippet } from '../../../Modules/Hub/Models';
import {
    hubAuthMiddleware,
    snippetCodeUploadMiddleware,
    snippetUploadLimiter,
} from '../../../Modules/Hub/Middleware';

const MAX_CODE_LENGTH = 200000;
const MAX_TITLE_LENGTH = 200;

const EXT_TO_LANGUAGE: Record<string, string> = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.dart': 'dart',
    '.py': 'python',
    '.rb': 'ruby',
    '.php': 'php',
    '.java': 'java',
    '.kt': 'kotlin',
    '.swift': 'swift',
    '.go': 'go',
    '.rs': 'rust',
    '.scala': 'scala',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.ps1': 'shell',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.css': 'css',
    '.html': 'html',
    '.xml': 'xml',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.graphql': 'graphql',
    '.txt': 'plaintext',
};

function isBinaryLike(content: Buffer): boolean {
    for (let i = 0; i < content.length; i += 1) {
        if (content[i] === 0) return true;
    }
    return false;
}

function trimText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function cleanTitle(value: string): string {
    return value
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, MAX_TITLE_LENGTH);
}

function normalizeLanguage(value: string, fallback: string): string {
    const normalized = value.toLowerCase().trim();
    if (!normalized) return fallback;
    if (!/^[a-z0-9#+._-]{1,32}$/.test(normalized)) return fallback;
    return normalized;
}

function inferLanguageFromFilename(filename: string): string {
    const dot = filename.lastIndexOf('.');
    if (dot === -1) return 'plaintext';
    const ext = filename.slice(dot).toLowerCase();
    return EXT_TO_LANGUAGE[ext] || 'plaintext';
}

function resolveCodePayload(req: Request): { code: string; inferredLanguage?: string; source: 'body' | 'file' } | null {
    const file = req.file as Express.Multer.File | undefined;

    if (file) {
        if (!file.buffer || file.buffer.length === 0) return null;
        if (file.buffer.length > MAX_CODE_LENGTH) return null;
        if (isBinaryLike(file.buffer)) return null;

        const text = file.buffer.toString('utf8');
        if (!text.trim()) return null;
        if (text.length > MAX_CODE_LENGTH) return null;

        return {
            code: text,
            inferredLanguage: inferLanguageFromFilename(file.originalname || ''),
            source: 'file',
        };
    }

    const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
    if (!rawCode.trim()) return null;
    if (rawCode.length > MAX_CODE_LENGTH) return null;

    return { code: rawCode, source: 'body' };
}

function asString(value: unknown, fallback = ''): string {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : fallback;
    }
    if (value == null) return fallback;
    const casted = String(value).trim();
    return casted.length > 0 ? casted : fallback;
}

function toOptionalBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
        if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    return null;
}

export default {
    name: 'Hub Update Snippet',
    path: '/hub/snippets/:id',
    method: 'put',
    category: 'hub',
    validator: [snippetUploadLimiter, snippetCodeUploadMiddleware.single('codeFile')],
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const { id } = req.params;
        const { clearPassword } = req.body || {};

        const snippet = await HubSnippet.findOne({ shortId: id, userId: user._id });
        if (!snippet) {
            return res.status(404).json({ status: false, msg: 'Snippet no encontrado' });
        }

        const codePayload = resolveCodePayload(req);
        const nextTitle = cleanTitle(asString(req.body?.title, snippet.title));
        const nextLanguage = normalizeLanguage(
            asString(req.body?.language),
            codePayload?.inferredLanguage || snippet.language,
        );
        const nextCode = codePayload?.code || snippet.code;
        const nextAllowRaw = toOptionalBoolean(req.body?.allowRaw);
        const nextAllowDownload = toOptionalBoolean(req.body?.allowDownload);

        if (!nextTitle || !nextCode) {
            return res.status(400).json({ status: false, msg: 'title y code requeridos' });
        }

        if (nextCode.length > MAX_CODE_LENGTH) {
            return res.status(400).json({ status: false, msg: 'Código demasiado largo (máx 200KB)' });
        }

        snippet.title = nextTitle;
        snippet.language = nextLanguage;
        snippet.code = nextCode;
        if (nextAllowRaw !== null) {
            (snippet as any).allowRaw = nextAllowRaw;
        }
        if (nextAllowDownload !== null) {
            (snippet as any).allowDownload = nextAllowDownload;
        }

        if (clearPassword === true) {
            (snippet as any).passwordHash = undefined;
        }

        const password = trimText(req.body?.password);
        if (password.length > 0) {
            (snippet as any).passwordHash = await bcrypt.hash(password, 10);
        }

        await snippet.save();

        return res.json({
            status: true,
            data: {
                shortId: snippet.shortId,
                title: snippet.title,
                language: snippet.language,
                code: snippet.code,
                viewCount: snippet.viewCount,
                createdAt: (snippet as any).createdAt,
                updatedAt: (snippet as any).updatedAt,
                hasPassword: Boolean((snippet as any).passwordHash),
                allowRaw: (snippet as any).allowRaw !== false,
                allowDownload: (snippet as any).allowDownload !== false,
                source: codePayload?.source || 'body',
            },
        });
    },
};
