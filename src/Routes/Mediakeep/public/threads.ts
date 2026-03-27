import type { Request, Response } from 'express';
import Threads from '../../../Core/Scraper/threads';
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
        try {
            const { url } = req.body;
            const results = await Threads.download(url);


            if (!results.status) {
                return res.status(404).json({
                    status: false,
                    msg: 'No se encontró contenido para descargar.'
                });
            }

            return res.status(200).json(results);

        } catch (e: any) {
            console.error('Error en descarga de Threads:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
