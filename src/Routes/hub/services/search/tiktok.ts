import type { Request, Response } from 'express';
import TikTok from '../../../../Core/Scraper/tiktok';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub TikTok Search',
    path: '/hub/search/tiktok',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'search'],
    tags: ['tiktok', 'search'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Search TikTok videos by text.',
    execution: async (req: Request, res: Response) => {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required for search.' });
        }

        try {
            const result = await TikTok.search(query);
            if (!result.status || !result.data) {
                return res.status(404).json({ status: false, msg: result.error || 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-TikTok-Search] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search TikTok.', error: e.message });
        }
    },
};
