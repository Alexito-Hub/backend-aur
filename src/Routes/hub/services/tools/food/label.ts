import type { Request, Response } from 'express';
import OpenFoodFacts from '../../../../../Core/Scraper/openfoodfacts';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub Food Label',
    path: '/hub/tools/food/label',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'tools'],
    tags: ['food', 'label'],
    parameter: ['label'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'List products by label.',
    execution: async (req: Request, res: Response) => {
        const { label, page, pageSize } = req.body;

        if (!label) {
            return res.status(400).json({ status: false, msg: 'Label is required.' });
        }

        try {
            const result = await OpenFoodFacts.label(label, page, pageSize);
            if (!result.status) {
                return res.status(404).json({ status: false, msg: result.error || 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-Food-Label] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search by label.', error: e.message });
        }
    },
};
