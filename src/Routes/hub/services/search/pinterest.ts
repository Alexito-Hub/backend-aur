import type { Request, Response } from 'express';
import Pinterest from '../../../../Core/Scraper/pinterest';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Pinterest Search',
    path: '/hub/search/pinterest',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'search'],
    tags: ['pinterest', 'search'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Search pins on Pinterest.',
    execution: async (req: Request, res: Response) => {
        const { query, limit } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required.' });
        }

        try {
            const data = await Pinterest.search(query, limit || 20);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Pinterest-Search] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search Pinterest.', error: e.message });
        }
    },
};
