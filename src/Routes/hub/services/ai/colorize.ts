import type { Request, Response } from 'express';
import Colorize from '../../../../Core/Scraper/colorize';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub AI Colorize',
    path: '/hub/ai/colorize',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'ai'],
    tags: ['ai', 'image', 'colorize'],
    parameter: ['imagePath'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Colorize black and white images.',
    execution: async (req: Request, res: Response) => {
        const { imagePath } = req.body;

        if (!imagePath) {
            return res.status(400).json({ status: false, msg: 'imagePath is required.' });
        }

        try {
            const outputPath = await Colorize.process(imagePath);
            return res.status(200).json({ status: true, msg: 'Success', data: { path: outputPath } });
        } catch (e: any) {
            console.error('[Hub-AI-Colorize] Error:', e);
            return res.status(500).json({ status: false, msg: 'AI service failed (colorize).', error: e.message });
        }
    },
};
