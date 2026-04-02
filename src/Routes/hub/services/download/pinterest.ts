import type { Request, Response } from 'express';
import Pinterest from '../../../../Core/Scraper/pinterest';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Pinterest Download',
    path: '/hub/download/pinterest',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['pinterest', 'download'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Download metadata for a Pinterest pin.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required.' });
        }

        try {
            const data = await Pinterest.pindl(url);
            if (!data) {
                return res.status(404).json({ status: false, msg: 'Pin not found or unavailable.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Pinterest-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process Pinterest download.', error: e.message });
        }
    },
};
