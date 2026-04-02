import type { Request, Response } from 'express';
import OpenFoodFacts from '../../../../../Core/Scraper/openfoodfacts';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub Food Nutriscore',
    path: '/hub/tools/food/nutriscore',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'tools'],
    tags: ['food', 'nutriscore'],
    parameter: ['country', 'nutriscore'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'List products by country and nutriscore level.',
    execution: async (req: Request, res: Response) => {
        const { country, nutriscore, page, pageSize } = req.body;

        if (!country || !nutriscore) {
            return res.status(400).json({ status: false, msg: 'Country and nutriscore are required.' });
        }

        try {
            const result = await OpenFoodFacts.nutriscore(country, nutriscore, page, pageSize);
            if (!result.status) {
                return res.status(404).json({ status: false, msg: result.error || 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-Food-Nutriscore] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search by nutriscore.', error: e.message });
        }
    },
};
