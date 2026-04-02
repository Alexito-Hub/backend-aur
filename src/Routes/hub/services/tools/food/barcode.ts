import type { Request, Response } from 'express';
import OpenFoodFacts from '../../../../../Core/Scraper/openfoodfacts';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub Food Barcode',
    path: '/hub/tools/food/barcode',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'tools'],
    tags: ['food', 'barcode'],
    parameter: ['barcode'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Find a product by barcode.',
    execution: async (req: Request, res: Response) => {
        const { barcode } = req.body;

        if (!barcode) {
            return res.status(400).json({ status: false, msg: 'Barcode is required.' });
        }

        try {
            const result = await OpenFoodFacts.barcode(barcode);
            if (!result.status) {
                return res.status(404).json({ status: false, msg: result.error || 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-Food-Barcode] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search by barcode.', error: e.message });
        }
    },
};
