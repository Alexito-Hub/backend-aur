import type { Request, Response } from 'express';
import YouTube from '../../../../Core/Scraper/youtube';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub YouTube Download',
    path: '/hub/download/youtube',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['youtube', 'download'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Fetch downloadable formats for a YouTube video.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required for download.' });
        }

        try {
            const data = await YouTube.getInfo(url);
            if (!data) {
                return res.status(404).json({ status: false, msg: 'Video not found or unavailable.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-YouTube-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process YouTube download.', error: e.message });
        }
    },
};
