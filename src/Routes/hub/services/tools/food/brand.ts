import type { Request, Response } from 'express';
import OpenFoodFacts from '../../../../../Core/Scraper/openfoodfacts';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub Food Brand',
    path: '/hub/tools/food/brand',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'tools'],
    tags: ['food', 'brand'],
    parameter: ['brand', 'category'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'List products by brand and category.',
    execution: async (req: Request, res: Response) => {
        const { brand, category, page, pageSize } = req.body;

        if (!brand || !category) {
            return res.status(400).json({ status: false, msg: 'Brand and category are required.' });
        }

        try {
            const result = await OpenFoodFacts.brand(brand, category, page, pageSize);
            if (!result.status) {
                return res.status(404).json({ status: false, msg: result.error || 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-Food-Brand] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search by brand.', error: e.message });
        }
    },
};
