import type { Request, Response } from 'express';
import Pinterest from '../../../Core/Scraper/pinterest';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub Pinterest Service',
    path: '/hub/pinterest',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, query, url, limit } = req.body;

        try {
            switch (method) {
                case 'search':
                    if (!query) return res.status(400).json({ status: false, msg: 'Query requerida.' });
                    const searchData = await Pinterest.search(query, limit || 20);
                    return res.status(200).json({ status: true, data: searchData });
                case 'download':
                    if (!url) return res.status(400).json({ status: false, msg: 'URL requerida.' });
                    const downloadData = await Pinterest.pindl(url);
                    if (!downloadData) return res.status(404).json({ status: false, msg: 'Pin no encontrado o no disponible.' });
                    return res.status(200).json({ status: true, data: downloadData });
                default:
                    return res.status(400).json({ status: false, msg: 'Método no válido. Use "search" o "download".' });
            }
        } catch (e: any) {
            console.error(`[Hub-Pinterest] Error:`, e);
            return res.status(500).json({ status: false, msg: `Error en servicio de Pinterest.`, error: e.message });
        }
    }
};
