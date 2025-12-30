import type { Request, Response } from 'express';
import SpotifyScraper from '../../Utils/scrapper/spotify';

export default {
    name: 'Search Spotify Tracks',
    path: '/music/search',
    method: 'post',
    category: 'music',
    example: {
        url: '/music/search',
        body: { query: 'artist - song name', limit: 20 }
    },
    parameter: ['query'],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        const { query } = req.body;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ status: false, msg: 'Query is required' });
        }
        next();
    },
    execution: async (req: Request, res: Response) => {
        const { query, limit = 20 } = req.body;
        try {
            const scraper = new SpotifyScraper();
            const results = await scraper.search(query, 'track', limit);

            if (!results || results.length === 0) {
                return res.status(404).json({
                    status: false,
                    msg: 'No results found for this query.'
                });
            }

            return res.status(200).json({
                status: true,
                data: results
            });

        } catch (e: any) {
            console.error('Error in Spotify search:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Internal server error.'
            });
        }
    }
};
