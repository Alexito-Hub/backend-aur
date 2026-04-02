import { Request, Response } from 'express';
import { HubSnippet } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

function buildOwner(owner: any) {
    if (!owner || typeof owner !== 'object') return null;

    const id = owner._id ? String(owner._id) : '';
    const displayName = typeof owner.displayName === 'string' ? owner.displayName : '';
    const email = typeof owner.email === 'string' ? owner.email : '';

    return {
        id,
        displayName,
        email,
    };
}

export default {
    name: 'Hub Get Snippet',
    path: '/hub/snippets/:id',
    method: 'get',
    category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const { id } = req.params;

        const snippet = await HubSnippet.findOne({ shortId: id, userId: user._id })
            .populate('userId', 'displayName email');

        if (!snippet) {
            return res.status(404).json({ status: false, msg: 'Snippet no encontrado' });
        }

        const owner = buildOwner((snippet as any).userId);

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
                owner,
            },
        });
    },
};
