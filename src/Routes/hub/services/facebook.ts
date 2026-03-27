import type { Request, Response } from 'express';
import Facebook from '../../../Core/Scraper/facebook';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub Facebook Service',
    path: '/hub/facebook',
    method: 'post',
    category: 'hub',
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        try {
            const data = await Facebook.download(url);
            return res.status(200).json({ status: true, data });
        } catch (e: any) {
            console.error(`[Hub-Facebook] Error:`, e);
            return res.status(500).json({ 
                status: false, 
                msg: `Error al procesar Facebook.`, 
                error: e.message 
            });
        }
    }
};
