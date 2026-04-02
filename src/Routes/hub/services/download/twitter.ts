import type { Request, Response } from 'express';
import Twitter from '../../../../Core/Scraper/twitter';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Twitter Download',
    path: '/hub/download/twitter',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['twitter', 'x', 'download'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Download Twitter/X media content.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required.' });
        }

        try {
            const data = await Twitter.download(url);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Twitter-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process Twitter/X.', error: e.message });
        }
    },
};
