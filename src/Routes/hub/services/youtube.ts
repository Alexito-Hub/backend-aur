import type { Request, Response } from 'express';
import YouTube from '../../../Core/Scraper/youtube';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub YouTube Service',
    path: '/hub/youtube',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, url, query } = req.body;

        try {
            switch (method) {
                case 'search':
                    if (!query) return res.status(400).json({ status: false, msg: 'La consulta (query) es requerida para buscar.' });
                    const searchData = await YouTube.search(query);
                    if (!searchData || searchData.length === 0) return res.status(404).json({ status: false, msg: 'No se encontraron resultados.' });
                    return res.status(200).json({ status: true, data: searchData });

                case 'download':
                    if (!url) return res.status(400).json({ status: false, msg: 'La URL es requerida para descargar.' });
                    const downloadData = await YouTube.getInfo(url); // Usamos getInfo para obtener los formatos
                    if (!downloadData) return res.status(404).json({ status: false, msg: 'Video no encontrado o no disponible.' });
                    return res.status(200).json({ status: true, data: downloadData });

                case 'info':
                    if (!url) return res.status(400).json({ status: false, msg: 'La URL es requerida para obtener información.' });
                    const infoData = await YouTube.getInfo(url);
                    if (!infoData) return res.status(404).json({ status: false, msg: 'Información no encontrada.' });
                    return res.status(200).json({ status: true, data: infoData });

                default:
                    return res.status(400).json({ 
                        status: false, 
                        msg: 'Método no válido. Use "search", "download" o "info".' 
                    });
            }
        } catch (e: any) {
            console.error(`[Hub-YouTube] Error en método ${method}:`, e);
            return res.status(500).json({ 
                status: false, 
                msg: `Error al procesar YouTube (${method}).`, 
                error: e.message 
            });
        }
    }
};
