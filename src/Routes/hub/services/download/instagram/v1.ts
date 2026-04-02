import type { Request, Response } from 'express';
import InstagramV1 from '../../../../../Core/Scraper/instagram';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub Instagram Download V1',
    path: '/hub/download/instagram/v1',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['instagram', 'download', 'v1'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Download Instagram content using the V1 engine.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'Instagram URL is required.' });
        }

        try {
            const data = await InstagramV1.download(url);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Instagram-V1-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process Instagram v1.', error: e.message });
        }
    },
};
