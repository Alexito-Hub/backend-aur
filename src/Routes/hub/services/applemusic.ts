import type { Request, Response } from 'express';
import AppleMusic from '../../../Core/Scraper/applemusic';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub Apple Music Service',
    path: '/hub/applemusic',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, query } = req.body;

        try {
            switch (method) {
                case 'search':
                    if (!query) return res.status(400).json({ status: false, msg: 'La consulta (query) es requerida para buscar.' });
                    const result = await AppleMusic.search(query);
                    if (Array.isArray(result)) {
                        return res.status(200).json({ status: true, data: result });
                    } else if (result && 'error' in result) {
                        return res.status(404).json({ status: false, msg: result.error });
                    }
                    return res.status(200).json({ status: true, data: result });

                default:
                    return res.status(400).json({ 
                        status: false, 
                        msg: 'Método no válido. Use "search".' 
                    });
            }
        } catch (e: any) {
            console.error(`[Hub-AppleMusic] Error:`, e);
            return res.status(500).json({ 
                status: false, 
                msg: `Error al procesar Apple Music.`, 
                error: e.message 
            });
        }
    }
};
