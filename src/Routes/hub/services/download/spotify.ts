import type { Request, Response } from 'express';
import Spotify from '../../../../Core/Scraper/spotify';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Spotify Download',
    path: '/hub/download/spotify',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'download'],
    tags: ['spotify', 'download'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Download available assets for a Spotify track.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required for download.' });
        }

        try {
            const data = await Spotify.download(url);
            if (!data) {
                return res.status(404).json({ status: false, msg: 'Track not found or unavailable for download.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Spotify-Download] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to process Spotify download.', error: e.message });
        }
    },
};
