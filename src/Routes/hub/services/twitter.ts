import type { Request, Response } from 'express';
import Twitter from '../../../Core/Scraper/twitter';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub Twitter Service',
    path: '/hub/twitter',
    method: 'post',
    category: 'hub',
    parameter: ['url'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { url } = req.body;

        try {
            const data = await Twitter.download(url);
            return res.status(200).json({ status: true, data });
        } catch (e: any) {
            console.error(`[Hub-Twitter] Error:`, e);
            return res.status(500).json({ 
                status: false, 
                msg: `Error al procesar Twitter (X).`, 
                error: e.message 
            });
        }
    }
};
