import { Request, Response } from 'express';
import { HubSnippet } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub List Snippets',
    path: '/hub/snippets',
    method: 'get',
    category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const snippets = await HubSnippet.find({ userId: user._id }).select('-code -passwordHash').sort('-createdAt').limit(100);
        return res.json({ status: true, data: snippets.map(s => ({ ...s.toObject(), hasPassword: !!s.passwordHash })) });
    }
};