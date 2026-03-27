import { Request, Response } from 'express';
import { HubRequestLog } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub User Logs',
    path: '/hub/user/logs',
    method: 'get',
    category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = 50;
        const logs = await HubRequestLog.find({ userId: user._id }).sort('-createdAt').skip((page - 1) * limit).limit(limit);
        return res.json({ status: true, data: logs });
    }
};