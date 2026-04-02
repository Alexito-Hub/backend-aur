import type { Request, Response } from 'express';
import LlamaCoder from '../../../../../Core/Scraper/llamacode';
import { hubAuthMiddleware } from '../../../middleware';

export default {
    name: 'Hub LlamaCoder Upload',
    path: '/hub/tools/upload/llamacoder',
    method: 'post',
    category: 'services',
    categories: ['hub', 'services', 'tools'],
    tags: ['llamacoder', 'upload'],
    parameter: [],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    description: 'Upload files to get a processable URL with LlamaCoder.',
    execution: async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).json({ status: false, msg: 'File is required.' });
        }

        try {
            const url = await LlamaCoder.upload(req.file.buffer, req.file.originalname);
            return res.status(200).json({ status: true, msg: 'Success', data: { url } });
        } catch (e: any) {
            console.error('[Hub-LlamaCoder-Upload] Error:', e);
            return res.status(500).json({ status: false, msg: 'Failed to upload file to LlamaCoder.', error: e.message });
        }
    },
};
