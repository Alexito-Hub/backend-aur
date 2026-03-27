import type { Request, Response } from 'express';
import Spotify from '../../../Core/Scraper/spotify';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub Spotify Service',
    path: '/hub/spotify',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, url, query, limit } = req.body;

        try {
            switch (method) {
                case 'search':
                    if (!query) return res.status(400).json({ status: false, msg: 'La consulta (query) es requerida para buscar.' });
                    const searchData = await Spotify.search(query, 'track', limit || 20);
                    if (!searchData || searchData.length === 0) return res.status(404).json({ status: false, msg: 'No se encontraron resultados.' });
                    return res.status(200).json({ status: true, data: searchData });

                case 'download':
                    if (!url) return res.status(400).json({ status: false, msg: 'La URL es requerida para descargar.' });
                    const downloadData = await Spotify.download(url);
                    if (!downloadData) return res.status(404).json({ status: false, msg: 'Track no encontrado o no disponible para descarga.' });
                    return res.status(200).json({ status: true, data: downloadData });

                case 'info':
                    if (!url) return res.status(400).json({ status: false, msg: 'La URL es requerida para obtener información.' });
                    const infoData = await Spotify.getInfo(url);
                    if (!infoData) return res.status(404).json({ status: false, msg: 'Información no encontrada.' });
                    return res.status(200).json({ status: true, data: infoData });

                default:
                    return res.status(400).json({ 
                        status: false, 
                        msg: 'Método no válido. Use "search", "download" o "info".' 
                    });
            }
        } catch (e: any) {
            console.error(`[Hub-Spotify] Error en método ${method}:`, e);
            return res.status(500).json({ 
                status: false, 
                msg: `Error al procesar Spotify (${method}).`, 
                error: e.message 
            });
        }
    }
};
