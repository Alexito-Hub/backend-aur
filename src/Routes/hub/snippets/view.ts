import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { HubSnippet } from '../../../Modules/Hub/Models';

const SHORT_ID_PATTERN = /^[a-f0-9]{10}$/i;

function normalizeShortId(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
}

function buildOwner(owner: any) {
    if (!owner || typeof owner !== 'object') return null;

    return {
        id: owner._id ? String(owner._id) : '',
        displayName: typeof owner.displayName === 'string' ? owner.displayName : '',
        email: typeof owner.email === 'string' ? owner.email : '',
    };
}

export default {
    name: 'Hub View Snippet',
    path: '/hub/snippets/:id/view',
    method: 'post',
    category: 'hub',
    execution: async (req: Request, res: Response) => {
        const id = normalizeShortId(req.params?.id);
        if (!SHORT_ID_PATTERN.test(id)) {
            return res.status(400).json({ status: false, msg: 'ID de snippet inválido' });
        }

        const { password } = req.body || {};

        const snippet = await HubSnippet.findOne({ shortId: id })
            .populate('userId', 'displayName email');

        if (!snippet) return res.status(404).json({ status: false, msg: 'Snippet no encontrado' });

        if (snippet.passwordHash) {
            if (!password) return res.status(401).json({ status: false, requiresPassword: true, msg: 'Contraseña requerida' });
            const match = await bcrypt.compare(password, snippet.passwordHash);
            if (!match) return res.status(401).json({ status: false, msg: 'Contraseña incorrecta' });
        }

        snippet.viewCount += 1;
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
                allowRaw: (snippet as any).allowRaw !== false,
                allowDownload: (snippet as any).allowDownload !== false,
                owner: buildOwner((snippet as any).userId),
            },
        });
    }
};