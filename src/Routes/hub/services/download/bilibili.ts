import type { Request, Response } from 'express';
import Bilibili from '../../../../Core/Scraper/bilibili';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Bilibili Download',
    path: '/hub/download/bilibili',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['bilibili', 'download'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Download metadata for Bilibili videos.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required.' });
        }

        try {
            const data = await Bilibili.download(url);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Bilibili-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process Bilibili download.', error: e.message });
        }
    },
};
