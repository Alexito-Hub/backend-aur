import type { Request, Response } from 'express';
import TikTok from '../../../Core/Scraper/tiktok';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub TikTok Service',
    path: '/hub/tiktok',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, url, query, region } = req.body;

        try {
            switch (method) {
                case 'search':
                    if (!query) return res.status(400).json({ status: false, msg: 'La consulta (query) es requerida para buscar.' });
                    const searchResult = await TikTok.search(query);
                    if (!searchResult.status || !searchResult.data) return res.status(404).json({ status: false, msg: searchResult.error || 'No se encontraron resultados.' });
                    return res.status(200).json({ status: true, data: searchResult.data });

                case 'download':
                    if (!url) return res.status(400).json({ status: false, msg: 'La URL es requerida para descargar.' });
                    const downloadResult = await TikTok.download(url);
                    if (!downloadResult.status || !downloadResult.data) return res.status(404).json({ status: false, msg: downloadResult.error || 'Video no encontrado o privado.' });
                    return res.status(200).json({ status: true, data: downloadResult.data });

                case 'trending':
                    const trendResult = await TikTok.trending(region || 'US');
                    if (!trendResult.status || !trendResult.data) return res.status(404).json({ status: false, msg: trendResult.error || 'No se encontraron tendencias.' });
                    return res.status(200).json({ status: true, data: trendResult.data });

                default:
                    return res.status(400).json({ 
                        status: false, 
                        msg: 'Método no válido. Use "search", "download" o "trending".' 
                    });
            }
        } catch (e: any) {
            console.error(`[Hub-TikTok] Error en método ${method}:`, e);
            return res.status(500).json({ 
                status: false, 
                msg: `Error al procesar TikTok (${method}).`, 
                error: e.message 
            });
        }
    }
};
