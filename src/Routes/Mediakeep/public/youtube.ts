import type { Request, Response } from 'express';
import YouTube from '../../../Core/Scraper/youtube';
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
        const url = req.body?.url || req.query?.url;
        const version = String(req.body?.version || req.query?.version || 'v1').toLowerCase();
        const mediaType = String(req.body?.mediaType || req.query?.mediaType || 'audio').toLowerCase();
        const title = req.body?.title || req.query?.title;

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

        try {
            if (version === 'v1') {
                const result = await YouTube.download_v1(url).catch((e: any) => console.error('Error en descarga v1 de YouTube:', e))
                return sendV1Response(result);
            }

            if (version === 'v2') {
                const isVideo = mediaType === 'video';
                const bufferResult = await YouTube.download_v2(url, { video: isVideo, title });
                return sendMediaResponse('v2', bufferResult);
            }

            const result = await YouTube.download_v1(url);
            return sendV1Response(result);

        } catch (e: any) {
            console.error('Error en descarga de YouTube:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
