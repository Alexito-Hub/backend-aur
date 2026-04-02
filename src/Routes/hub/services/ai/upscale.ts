import type { Request, Response } from 'express';
import WinkAI, { TASK } from '../../../../Core/Scraper/winkai';
import { hubAuthMiddleware } from '../../middleware';

export default {
    name: 'Hub AI Upscale',
    path: '/hub/ai/upscale',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'ai'],
    tags: ['ai', 'image', 'upscale'],
    parameter: ['imagePath'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Upscale images to high resolution with AI.',
    execution: async (req: Request, res: Response) => {
        const { imagePath, type } = req.body;

        if (!imagePath) {
            return res.status(400).json({ status: false, msg: 'imagePath is required.' });
        }

        try {
            await WinkAI.init();
            const upload = await WinkAI.uploadFile(imagePath);
            const taskCfg = type === 'ultra' ? TASK.ULTRA_HD : TASK.HD;
            const task = await WinkAI.submitTask(upload, taskCfg);
            const data = await WinkAI.waitForResult(task);
            return res.status(200).json({ status: true, msg: 'Success', data });
        } catch (e: any) {
            console.error('[Hub-AI-Upscale] Error:', e);
            return res.status(500).json({ status: false, msg: 'AI service failed (upscale).', error: e.message });
        }
    },
};
