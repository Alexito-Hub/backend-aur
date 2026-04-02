import type { Request, Response } from 'express';
import Facebook from '../../../../Core/Scraper/facebook';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Facebook Download',
    path: '/hub/download/facebook',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['facebook', 'download'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Download Facebook media content.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required.' });
        }

        try {
            const data = await Facebook.download(url);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Facebook-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process Facebook.', error: e.message });
        }
    },
};
