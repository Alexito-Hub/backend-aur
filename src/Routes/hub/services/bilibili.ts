import type { Request, Response } from 'express';
import Bilibili from '../../../Core/Scraper/bilibili';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub Bilibili Service',
    path: '/hub/bilibili',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, url } = req.body;

        try {
            switch (method) {
                case 'download':
                    if (!url) return res.status(400).json({ status: false, msg: 'URL requerida.' });
                    const result = await Bilibili.download(url);
                    return res.status(200).json({ status: true, data: result });
                default:
                    return res.status(400).json({ status: false, msg: 'Método no válido. Use "download".' });
            }
        } catch (e: any) {
            console.error(`[Hub-Bilibili] Error:`, e);
            return res.status(500).json({ status: false, msg: `Error en servicio de Bilibili.`, error: e.message });
        }
    }
};
