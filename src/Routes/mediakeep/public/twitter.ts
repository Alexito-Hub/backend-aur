import type { Request, Response } from 'express';
import Twitter from '../../../Utils/Scrapper/twitter';
import Middlewares from '../middlewares';

export default {
    name: 'Download Twitter Media',
    path: '/download/twitter',
    method: 'post',
    category: 'download',
    example: {
        url: '/download/twitter',
        body: { url: 'https://x.com/user/status/123456789' }
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
    validator: Middlewares.guest('twitter'),
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;
        try {
            const scraper = new Twitter();
            const result = await scraper.download(url);

            if (!result || !result.media || result.media.length === 0) {
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
            console.error('Error en descarga de Twitter:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
