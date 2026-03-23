import type { Request, Response } from 'express';
import AppToken from '../../Middleware/appToken';
import Cache from '../../Utils/System/cache';
import axios from 'axios';

/**
 * GET /status/platforms
 * Checks the health of all 8 download platforms using internal calls.
 * - 5 min cache with key `system_platform_status`
 * - Mutex (isRunning) to avoid parallel executions — polls up to 25s
 * - Batches of 3 platforms in parallel to avoid saturating scrapers
 * - Internal calls include `x-status-check` header to bypass rate limits
 */

const CACHE_KEY = 'system_platform_status';
const CACHE_TTL_SECONDS = 5 * 60;
const BATCH_SIZE = 3;
const MUTEX_POLL_MS = 500;
const MUTEX_TIMEOUT_MS = 25_000;

let isRunning = false;

/** URLs de prueba para cada plataforma */
const testUrls: Record<string, { url: string; method: 'get' | 'post'; body?: Record<string, string> }> = {
    tiktok: {
        url: '/download/tiktok',
        method: 'post',
        body: { url: 'https://www.tiktok.com/@miakhalifa/video/7585261135566245150?is_from_webapp=1&sender_device=pc&web_id=7537168528312878597' }
    },
    facebook: {
        url: '/download/facebook',
        method: 'post',
        body: { url: 'https://www.facebook.com/share/v/1H4bvqqRXn/' }
    },
    spotify: {
        url: '/download/spotify',
        method: 'post',
        body: { url: 'https://open.spotify.com/intl-es/track/3IPJg1sdqLj12kFIndaonN?si=243e06727fb94cd5' }
    },
    threads: {
        url: '/download/threads',
        method: 'post',
        body: { url: 'https://www.threads.com/@naturaleza.xy/post/DSfmw4oEmKm?xmt=AQF0xOb75GoQffGeRocFb6o2Tn-FIPZ6JoYkORK5lTuBZg' }
    },
    youtube: {
        url: '/download/youtube',
        method: 'post',
        body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    },
    bilibili: {
        url: '/download/bilibili',
        method: 'post',
        body: { url: 'https://www.bilibili.com/video/BV1gRqLBHEFf/?share_source=copy_web' }
    },
    instagram: {
        url: '/download/instagram',
        method: 'post',
        body: { url: 'https://www.instagram.com/p/DSlaFUEFNXL/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==' }
    },
    twitter: {
        url: '/download/twitter',
        method: 'post',
        body: { url: 'https://x.com/vintageforestt/status/2003503125374918830?s=20' }
    },
};

/** Required field paths per platform to validate a successful response */
const requiredFields: Record<string, string> = {
    tiktok: 'data.media.nowatermark.play',
    facebook: 'data.type',
    spotify: 'data.download',
    threads: 'download',
    youtube: 'data.videos',
    bilibili: 'data.videos',
    instagram: 'data.media',
    twitter: 'data.media',
};

/** Navigate nested keys like "data.media.nowatermark.play" */
function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

/** Check whether the scraper response contains the expected data */
function validateResponse(platform: string, body: any): { valid: boolean; reason?: string } {
    const path = requiredFields[platform];
    if (!path) return { valid: true };

    const value = getNestedValue(body, path);

    if (value === undefined || value === null) {
        return { valid: false, reason: `Missing field: ${path}` };
    }

    // Arrays must be non-empty
    if (Array.isArray(value) && value.length === 0) {
        return { valid: false, reason: `Empty array at: ${path}` };
    }

    return { valid: true };
}

/** Call a single internal platform endpoint and return status info */
async function checkPlatform(
    platform: string,
    baseUrl: string,
    statusSecret: string
): Promise<{ ok: boolean; latency: number; statusCode: number; validation: { valid: boolean; reason?: string }; error?: string }> {
    const config = testUrls[platform];
    if (!config) {
        return { ok: false, latency: 0, statusCode: 0, validation: { valid: false, reason: 'No test URL configured' } };
    }

    const targetUrl = `${baseUrl}${config.url}`;
    const start = Date.now();

    try {
        const response = await axios({
            method: config.method.toUpperCase(),
            url: targetUrl,
            headers: {
                'Content-Type': 'application/json',
                'x-app-token': process.env.APP_SECRET_TOKEN || '',
                'x-status-check': statusSecret,
            },
            data: config.body,
            timeout: 20000,
            validateStatus: () => true, // Don't throw on non-2xx
        });

        const latency = Date.now() - start;
        const statusCode: number = response.status;

        if (statusCode !== 200) {
            return { ok: false, latency, statusCode, validation: { valid: false, reason: `HTTP ${statusCode}` } };
        }

        const validation = validateResponse(platform, response.data);
        return { ok: validation.valid, latency, statusCode, validation };
    } catch (err: any) {
        const latency = Date.now() - start;
        return { ok: false, latency, statusCode: 0, validation: { valid: false, reason: err.message }, error: err.message };
    }
}

/** Run platforms in batches of BATCH_SIZE in parallel */
async function checkAllPlatforms(baseUrl: string, statusSecret: string): Promise<Record<string, any>> {
    const platforms = Object.keys(testUrls);
    const results: Record<string, any> = {};

    for (let i = 0; i < platforms.length; i += BATCH_SIZE) {
        const batch = platforms.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(p => checkPlatform(p, baseUrl, statusSecret).then(r => [p, r] as [string, any]))
        );
        for (const [platform, result] of batchResults) {
            results[platform] = result;
        }
    }

    return results;
}

/** Wait until the mutex is released or timeout */
function waitForMutex(): Promise<boolean> {
    return new Promise((resolve) => {
        const start = Date.now();
        const interval = setInterval(() => {
            if (!isRunning) {
                clearInterval(interval);
                resolve(true);
            } else if (Date.now() - start > MUTEX_TIMEOUT_MS) {
                clearInterval(interval);
                resolve(false); // timed out
            }
        }, MUTEX_POLL_MS);
    });
}

export default {
    name: 'Platform Status Check',
    path: '/status/platforms',
    method: 'get',
    category: 'system',
    enabled: true,
    premium: false,
    error: false,
    logger: false,
    validator: AppToken.token,

    execution: async (req: Request, res: Response) => {
        // Check cache first
        const cached = Cache.get(CACHE_KEY);
        if (cached) {
            return res.status(200).json({ ...cached, cached: true });
        }

        // Mutex: if another request is already running, wait for it
        if (isRunning) {
            const released = await waitForMutex();
            if (released) {
                const cachedAfterWait = Cache.get(CACHE_KEY);
                if (cachedAfterWait) {
                    return res.status(200).json({ ...cachedAfterWait, cached: true });
                }
            }
            // Fallback: if still no cache, proceed (edgecase)
        }

        isRunning = true;
        try {
            const statusSecret = process.env.STATUS_CHECK_SECRET || 'internal';
            const protocol = req.protocol;
            const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
            const baseUrl = `${protocol}://${host}`;

            const data = await checkAllPlatforms(baseUrl, statusSecret);

            const payload = {
                status: true,
                cached: false,
                checkedAt: new Date().toISOString(),
                data,
            };

            Cache.set(CACHE_KEY, payload, CACHE_TTL_SECONDS);
            return res.status(200).json(payload);
        } catch (err: any) {
            return res.status(500).json({ status: false, msg: err.message });
        } finally {
            isRunning = false;
        }
    }
};
