import { Request, Response } from 'express';
import { HubRequestLog } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub User Metrics',
    path: '/hub/user/metrics',
    method: 'get',
    category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const totalUsed = await HubRequestLog.aggregate([{ $match: { userId: user._id, isSandbox: false } }, { $group: { _id: null, total: { $sum: '$creditsDeducted' } } }]);
        return res.json({
            status: true,
            data: { used: totalUsed[0]?.total ?? 0, available: user.credits, sandboxCredits: user.sandboxCredits, total: user.credits + user.sandboxCredits, plan: user.plan }
        });
    }
};