import type { Request, Response } from 'express';
import KimiAI from '../../../../Core/Scraper/kimiai';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub AI KimiAI',
    path: '/hub/ai/kimiai',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'ai'],
    tags: ['ai', 'kimiai'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Chat with the KimiAI model.',
    execution: async (req: Request, res: Response) => {
        const { query, chatId } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required.' });
        }

        try {
            const data = await KimiAI.chat(query, chatId || null);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-AI-KimiAI] Error:', e);
            return res.status(500).json({ status: false, msg: 'AI service failed (kimiai).', error: e.message });
        }
    },
};
