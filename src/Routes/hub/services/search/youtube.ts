import type { Request, Response } from 'express';
import YouTube from '../../../../Core/Scraper/youtube';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub YouTube Search',
    path: '/hub/search/youtube',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'search'],
    tags: ['youtube', 'search'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Search YouTube videos by text.',
    execution: async (req: Request, res: Response) => {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required for search.' });
        }

        try {
            const data = await YouTube.search(query);
            if (!data || data.length === 0) {
                return res.status(404).json({ status: false, msg: 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-YouTube-Search] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search YouTube.', error: e.message });
        }
    },
};
