import type { Request, Response } from 'express';
import SpotifyScraper from '../../../Utils/scrapper/spotify';
import Middlewares from '../middlewares';

export default {
    name: 'Download Spotify Track',
    path: '/download/spotify',
    method: 'post',
    category: 'download',
    example: {
        url: '/download/spotify',
        body: { url: 'https://open.spotify.com/track/123' }
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
    validator: Middlewares.guest('spotify'),
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;
        try {
            const scraper = new SpotifyScraper();
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
            console.error('Error en descarga de Spotify:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
