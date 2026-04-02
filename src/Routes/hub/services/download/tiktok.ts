import type { Request, Response } from 'express';
import TikTok from '../../../../Core/Scraper/tiktok';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub TikTok Download',
    path: '/hub/download/tiktok',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['tiktok', 'download'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Download metadata and assets for a TikTok video.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required for download.' });
        }

        try {
            const result = await TikTok.download(url);
            if (!result.status || !result.data) {
                return res.status(404).json({ status: false, msg: result.error || 'Video not found or private.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data: result.data });
        } catch (e: any) {
            console.error('[Hub-TikTok-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process TikTok download.', error: e.message });
        }
    },
};
