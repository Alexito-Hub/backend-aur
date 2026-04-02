import type { Request, Response } from 'express';
import NanoBanana from '../../../../Core/Scraper/nanobanana';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub AI NanoBanana',
    path: '/hub/ai/nanobanana',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'ai'],
    tags: ['ai', 'image', 'nanobanana'],
    parameter: ['imagePath', 'prompt'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Generate images using a prompt and base image.',
    execution: async (req: Request, res: Response) => {
        const { imagePath, prompt } = req.body;

        if (!imagePath || !prompt) {
            return res.status(400).json({ status: false, msg: 'imagePath and prompt are required.' });
        }

        try {
            const data = await NanoBanana.generate({ imagePath, prompt });
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-AI-NanoBanana] Error:', e);
            return res.status(500).json({ status: false, msg: 'AI service failed (nanobanana).', error: e.message });
        }
    },
};
