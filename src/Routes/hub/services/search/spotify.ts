import type { Request, Response } from 'express';
import Spotify from '../../../../Core/Scraper/spotify';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub Spotify Search',
    path: '/hub/search/spotify',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'search'],
    tags: ['spotify', 'search'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Search tracks on Spotify.',
    execution: async (req: Request, res: Response) => {
        const { query, limit } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required for search.' });
        }

        try {
            const data = await Spotify.search(query, 'track', limit || 20);
            if (!data || data.length === 0) {
                return res.status(404).json({ status: false, msg: 'No results found.' });
            }
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-Spotify-Search] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to search Spotify.', error: e.message });
        }
    },
};
