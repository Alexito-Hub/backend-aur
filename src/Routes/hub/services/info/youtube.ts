import type { Request, Response } from 'express';
import YouTube from '../../../../Core/Scraper/youtube';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub YouTube Info',
    path: '/hub/info/youtube',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'info'],
    tags: ['youtube', 'info'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Get detailed information for a YouTube video.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required to fetch information.' });
        }

        try {
            const data = await YouTube.getInfo(url);
            if (!data) {
                return res.status(404).json({ status: false, msg: 'Information not found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-YouTube-Info] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to fetch YouTube information.', error: e.message });
        }
    },
};
