import type { Request, Response } from 'express';
import OpenFoodFacts from '../../../../../Core/Scraper/openfoodfacts';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub Food Category',
    path: '/hub/tools/food/category',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'tools'],
    tags: ['food', 'category'],
    parameter: ['category'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'List products by category.',
    execution: async (req: Request, res: Response) => {
        const { category, page, pageSize } = req.body;

        if (!category) {
            return res.status(400).json({ status: false, msg: 'Category is required.' });
        }

        try {
            const result = await OpenFoodFacts.category(category, page, pageSize);
            if (!result.status) {
                return res.status(404).json({ status: false, msg: result.error || 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-Food-Category] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search by category.', error: e.message });
        }
    },
};
