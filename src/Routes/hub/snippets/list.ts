import { Request, Response } from 'express';
import { HubSnippet } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub List Snippets',
    path: '/hub/snippets',
    method: 'get',
    category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const parsedPage = Number.parseInt(String(req.query.page ?? '1'), 10);
        const parsedLimit = Number.parseInt(String(req.query.limit ?? '20'), 10);
        const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
        const limit = Number.isFinite(parsedLimit)
            ? Math.min(Math.max(parsedLimit, 1), 100)
            : 20;
        const skip = (page - 1) * limit;

        const [snippets, total] = await Promise.all([
            HubSnippet.find({ userId: user._id })
                .select('-passwordHash')
                .populate('userId', 'displayName email')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            HubSnippet.countDocuments({ userId: user._id }),
        ]);

        const items = snippets.map((snippet: any) => {
            const owner = snippet.userId && typeof snippet.userId === 'object'
                ? {
                    id: snippet.userId._id ? String(snippet.userId._id) : '',
                    displayName: snippet.userId.displayName || '',
                    email: snippet.userId.email || '',
                }
                : null;

            return {
                shortId: snippet.shortId,
                title: snippet.title,
                language: snippet.language,
                codePreview: typeof snippet.code === 'string' ? snippet.code.slice(0, 260) : '',
                hasPassword: Boolean(snippet.passwordHash),
                allowRaw: snippet.allowRaw !== false,
                allowDownload: snippet.allowDownload !== false,
                viewCount: snippet.viewCount || 0,
                createdAt: snippet.createdAt,
                updatedAt: snippet.updatedAt,
                owner,
            };
        });

        const pages = Math.max(1, Math.ceil(total / limit));

        return res.json({
            status: true,
            data: items,
            pagination: {
                total,
                page,
                pages,
                limit,
            },
        });
    }
};