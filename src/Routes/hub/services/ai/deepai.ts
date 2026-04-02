import type { Request, Response } from 'express';
import DeepAI from '../../../../Core/Scraper/deepai';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub AI DeepAI',
    path: '/hub/ai/deepai',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'ai'],
    tags: ['ai', 'deepai'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Multimodal chat with DeepAI.',
    execution: async (req: Request, res: Response) => {
        const { query, imagePath } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required.' });
        }

        try {
            const data = await DeepAI.chat(query, imagePath);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-AI-DeepAI] Error:', e);
            return res.status(500).json({ status: false, msg: 'AI service failed (deepai).', error: e.message });
        }
    },
};
