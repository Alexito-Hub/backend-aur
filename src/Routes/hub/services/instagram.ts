import type { Request, Response } from 'express';
import InstagramV1 from '../../../Core/Scraper/instagram';
import InstagramV2 from '../../../Core/Scraper/ig2';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub Instagram Service',
    path: '/hub/instagram',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, url } = req.body;

        if (!url) return res.status(400).json({ status: false, msg: 'La URL de Instagram es requerida.' });

        try {
            switch (method) {
                case 'v1':
                    const dataV1 = await InstagramV1.download(url);
                    return res.status(200).json({ status: true, data: dataV1 });

                case 'v2':
                    const dataV2 = await InstagramV2.download(url);
                    return res.status(200).json({ status: true, data: dataV2 });

                default:
                    return res.status(400).json({ 
                        status: false, 
                        msg: 'Método no válido. Use "v1" o "v2".' 
                    });
            }
        } catch (e: any) {
            console.error(`[Hub-Instagram] Error en método ${method}:`, e);
            return res.status(500).json({ 
                status: false, 
                msg: `Error al procesar Instagram (${method}).`, 
                error: e.message 
            });
        }
    }
};
