import type { Request, Response } from 'express';
import Photoroom from '../../../../Core/Scraper/Photoroom';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub AI Remove Background',
    path: '/hub/ai/remove-bg',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'ai'],
    tags: ['ai', 'image', 'remove-bg'],
    parameter: ['imagePath'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Remove the background from an image.',
    execution: async (req: Request, res: Response) => {
        const { imagePath } = req.body;

        if (!imagePath) {
            return res.status(400).json({ status: false, msg: 'imagePath is required.' });
        }

        try {
            const imageBuffer = await Photoroom.removebg(imagePath);
            res.set('Content-Type', 'image/png');
            return res.send(imageBuffer);
        } catch (e: any) {
            console.error('[Hub-AI-RemoveBg] Error:', e);
            return res.status(500).json({ status: false, msg: 'AI service failed (remove-bg).', error: e.message });
        }
    },
};
