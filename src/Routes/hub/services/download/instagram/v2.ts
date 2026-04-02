import type { Request, Response } from 'express';
import InstagramV2 from '../../../../../Core/Scraper/ig2';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub Instagram Download V2',
    path: '/hub/download/instagram/v2',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['instagram', 'download', 'v2'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Download Instagram content using the V2 engine.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'Instagram URL is required.' });
        }

        try {
            const data = await InstagramV2.download(url);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Instagram-V2-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process Instagram v2.', error: e.message });
        }
    },
};
