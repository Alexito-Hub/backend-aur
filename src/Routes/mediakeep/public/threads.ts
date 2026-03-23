import type { Request, Response } from 'express';
import ThreadsScraper from '../../../Utils/Scrapper/threads';
import Middlewares from '../middlewares';

export default {
    name: 'Download Threads Media',
    path: '/download/threads',
    method: 'post',
    category: 'download',
    example: {
        url: '/download/threads',
        body: { url: 'https://www.threads.net/@user/post/123' }
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
    validator: Middlewares.guest('threads'),
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;
        try {
            const scraper = new ThreadsScraper();
            const result = await scraper.download(url);

            if (!result.status) {
                return res.status(404).json({
                    status: false,
                    msg: 'No se encontró contenido para descargar.'
                });
            }

            return res.status(200).json(result);

        } catch (e: any) {
            console.error('Error en descarga de Threads:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
