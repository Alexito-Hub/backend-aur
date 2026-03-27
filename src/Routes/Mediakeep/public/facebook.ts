import type { Request, Response } from 'express';
import Facebook from '../../../Core/Scraper/facebook';
import Middlewares from '../middlewares';

export default {
    name: 'Download Facebook Media',
    path: '/download/facebook',
    method: 'post',
    category: 'download',
    example: {
        url: '/download/facebook',
        body: { url: 'https://www.facebook.com/user/posts/123' }
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
    // validator: Middlewares.guest('facebook'),
    execution: async (req: Request, res: Response) => {
        try {
            const url = req.body?.url || req.query?.url;
            const results = await Facebook.download(url);


            if (!results) {
                return res.status(404).json({
                    status: false,
                    msg: 'No se encontró contenido para descargar.'
                });
            }

            return res.status(200).json({
                status: true,
                data: results
            });

        } catch (e) {
            console.error('Error en descarga de Facebook:', e);
            return res.status(500).json({ status: false, msg: 'Error interno o enlace inválido.' });
        }
    }
};
