import type { Request, Response } from 'express';
import TikTok from '../../../../Core/Scraper/tiktok';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub TikTok Trending',
    path: '/hub/trending/tiktok',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'trending'],
    tags: ['tiktok', 'trending'],
    parameter: [],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Get TikTok trending results by region.',
    execution: async (req: Request, res: Response) => {
        const { region } = req.body;

        try {
            const result = await TikTok.trending(region || 'US');
            if (!result.status || !result.data) {
                return res.status(404).json({ status: false, msg: result.error || 'No trending results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-TikTok-Trending] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to fetch TikTok trending results.', error: e.message });
        }
    },
};
