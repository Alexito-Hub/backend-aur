import type { Request, Response } from 'express';
import YouTube from '../../../Utils/Scrapper/youtube';
import Middlewares from '../middlewares';

export default {
    name: 'Download YouTube Media',
    path: '/download/youtube',
    method: 'post',
    category: 'download',
    example: {
        url: '/download/youtube',
        body: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
    },
    parameter: ['url'],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        const url = req.body?.url || req.query?.url;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ status: false, msg: 'La URL es requerida' });
        }
        next();
    },
    validator: Middlewares.guest('youtube'),
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;
        const version = String(req.body?.version || req.query?.version || 'v1').toLowerCase();
        const mediaType = String(req.body?.mediaType || req.query?.mediaType || 'audio').toLowerCase();
        const title = req.body?.title || req.query?.title;

        const scraper = new YouTube();

        const sendMediaResponse = (versionLabel: string, bufferResult: { buffer: Buffer; mimetype: string; fileName: string; }) => {
            res.status(200)
                .type(bufferResult.mimetype)
                .set('Content-Disposition', `attachment; filename="${bufferResult.fileName}"`)
                .set('Cache-Control', 'no-store')
                .set('X-Content-Version', versionLabel);
            return res.send(bufferResult.buffer);
        };

        const sendV1Response = (result: any) => {
            return res.status(200).json({
                status: true,
                version: 'v1',
                data: result
            });
        };

        const tryV1 = async () => {
            const result = await scraper.download_v1(url);
            if (!result || (Array.isArray(result.videos)&&result.videos.length===0 && Array.isArray(result.audios)&&result.audios.length===0)) {
                throw new Error('No se encontró contenido en v1.');
            }
            return sendV1Response(result);
        };

        const tryV2 = async () => {
            const isVideo = mediaType === 'video';
            const bufferResult = await scraper.download_v2(url, { video: isVideo, title });
            return sendMediaResponse('v2', bufferResult);
        };

        const tryV3 = async () => {
            const isVideo = mediaType === 'video';
            const bufferResult = await scraper.download_v3(url, { video: isVideo, title });
            return sendMediaResponse('v3', bufferResult);
        };

        try {
            if (version === 'v1') {
                return await tryV1();
            }

            if (version === 'v2') {
                return await tryV2();
            }

            if (version === 'v3') {
                return await tryV3();
            }

            try {
                return await tryV1();
            } catch (v1Err) {
                console.warn('[YouTube] v1 failed, fallback a v2/v3:', (v1Err instanceof Error ? v1Err.message : v1Err));
                try {
                    return await tryV2();
                } catch (v2Err) {
                    console.warn('[YouTube] v2 failed, fallback a v3:', (v2Err instanceof Error ? v2Err.message : v2Err));
                    return await tryV3();
                }
            }

        } catch (e: any) {
            console.error('Error en descarga de YouTube:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
