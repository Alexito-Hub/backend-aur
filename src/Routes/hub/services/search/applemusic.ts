import type { Request, Response } from 'express';
import AppleMusic from '../../../../Core/Scraper/applemusic';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Apple Music Search',
    path: '/hub/search/applemusic',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'search'],
    tags: ['applemusic', 'search'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Search songs and content on Apple Music.',
    execution: async (req: Request, res: Response) => {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required for search.' });
        }

        try {
            const result = await AppleMusic.search(query);
            if (Array.isArray(result)) {
                return res.status(200).json({ status: true, msg: 'Success', data: result });
            }
            if (result && typeof result === 'object' && 'error' in result) {
                return res.status(404).json({ status: false, msg: (result as any).error });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result });
        } catch (e: any) {
            console.error('[Hub-AppleMusic-Search] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search Apple Music.', error: e.message });
        }
    },
};
