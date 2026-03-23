import type { Request, Response } from 'express';
import SpotifyScraper from '../../Utils/Scrapper/spotify';

// Simple in-memory cache (6 hours TTL)
interface CacheEntry {
    url: string;
    expiresAt: number;
}

const streamCache = new Map<string, CacheEntry>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

export default {
    name: 'Get Spotify Stream URL',
    path: '/music/stream',
    method: 'post',
    category: 'music',
    example: {
        url: '/music/stream',
        body: { url: 'https://open.spotify.com/track/xyz' }
    },
    parameter: ['url'],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        const { url } = req.body;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ status: false, msg: 'Track URL is required' });
        }
        next();
    },
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;
        try {
            // Extract track ID from URL
            const trackId = url.split('track/')[1]?.split('?')[0];
            if (!trackId) {
                return res.status(400).json({
                    status: false,
                    msg: 'Invalid Spotify track URL'
                });
            }

            // Check cache first
            const cached = streamCache.get(trackId);
            if (cached && cached.expiresAt > Date.now()) {
                console.log(`[Cache HIT] Track ${trackId}`);
                return res.status(200).json({
                    status: true,
                    streamUrl: cached.url,
                    cached: true,
                    expiresAt: new Date(cached.expiresAt).toISOString()
                });
            }

            // Cache miss - fetch new stream URL
            console.log(`[Cache MISS] Track ${trackId} - Fetching...`);
            const scraper = new SpotifyScraper();
            const result = await scraper.download(url);

            if (!result || !result.download) {
                return res.status(404).json({
                    status: false,
                    msg: 'Could not get stream URL for this track.'
                });
            }

            // Store in cache
            const expiresAt = Date.now() + CACHE_TTL;
            streamCache.set(trackId, {
                url: result.download,
                expiresAt
            });

            return res.status(200).json({
                status: true,
                streamUrl: result.download,
                cached: false,
                expiresAt: new Date(expiresAt).toISOString()
            });

        } catch (e: any) {
            console.error('Error in Spotify stream:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Internal server error.'
            });
        }
    }
};

// Cleanup expired cache entries every hour
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, value] of streamCache.entries()) {
        if (value.expiresAt < now) {
            streamCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`[Cache Cleanup] Removed ${cleaned} expired entries`);
    }
}, 60 * 60 * 1000);
