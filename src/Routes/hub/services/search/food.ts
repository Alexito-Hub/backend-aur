import type { Request, Response } from 'express';
import OpenFoodFacts from '../../../../Core/Scraper/openfoodfacts';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Food Search',
    path: '/hub/search/food',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'search'],
    tags: ['food', 'search'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Search food products on OpenFoodFacts by text.',
    execution: async (req: Request, res: Response) => {
        const { query, page, pageSize } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required.' });
        }

        try {
            const result = await OpenFoodFacts.search(query, page, pageSize);
            if (!result.status) {
                return res.status(404).json({ status: false, msg: result.error || 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-Food-Search] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search food products.', error: e.message });
        }
    },
};
