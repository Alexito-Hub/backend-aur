import type { Request, Response } from 'express';
import Spotify from '../../../../Core/Scraper/spotify';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Spotify Info',
    path: '/hub/info/spotify',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'info'],
    tags: ['spotify', 'info'],
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Get metadata for a Spotify track.',
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ status: false, msg: 'URL is required to fetch information.' });
        }

        try {
            const data = await Spotify.getInfo(url);
            if (!data) {
                return res.status(404).json({ status: false, msg: 'Information not found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Spotify-Info] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to fetch Spotify information.', error: e.message });
        }
    },
};
