import type { Request, Response } from 'express';
import Claude from '../../../../Core/Scraper/claude';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub AI Claude',
    path: '/hub/ai/claude',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'ai'],
    tags: ['ai', 'claude'],
    parameter: ['query'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Chat with the Claude model.',
    execution: async (req: Request, res: Response) => {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ status: false, msg: 'Query is required.' });
        }

        try {
            const data = await Claude.chat(query);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-AI-Claude] Error:', e);
            return res.status(500).json({ status: false, msg: 'AI service failed (claude).', error: e.message });
        }
    },
};
