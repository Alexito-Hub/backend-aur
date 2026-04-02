import type { Request, Response } from 'express';
import OpenFoodFacts from '../../../../../Core/Scraper/openfoodfacts';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub Food Country',
    path: '/hub/tools/food/country',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'tools'],
    tags: ['food', 'country'],
    parameter: ['country'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'List products by country.',
    execution: async (req: Request, res: Response) => {
        const { country, page, pageSize } = req.body;

        if (!country) {
            return res.status(400).json({ status: false, msg: 'Country is required.' });
        }

        try {
            const result = await OpenFoodFacts.country(country, page, pageSize);
            if (!result.status) {
                return res.status(404).json({ status: false, msg: result.error || 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-Food-Country] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search by country.', error: e.message });
        }
    },
};
