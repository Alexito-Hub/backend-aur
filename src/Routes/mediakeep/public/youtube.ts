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
        try {
            const scraper = new YouTube();
            const result = await scraper.download(url);

            if (!result) {
                return res.status(404).json({
                    status: false,
                    msg: 'No se encontró contenido para descargar.'
                });
            }

            return res.status(200).json({
                status: true,
                data: result
            });

        } catch (e: any) {
            console.error('Error en descarga de YouTube:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
