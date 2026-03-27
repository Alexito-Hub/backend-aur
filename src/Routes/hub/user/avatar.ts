import { Request, Response } from 'express';
import { HubUser } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware, uploadLimiter, avatarUploadMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub User Avatar',
    path: '/hub/user/avatar',
    method: 'post',
    category: 'hub',
    requires: hubAuthMiddleware, validator: [uploadLimiter, avatarUploadMiddleware.single('avatar')],
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const file = req.file;
        if (!file) return res.status(400).json({ status: false, msg: 'Imagen requerida (jpg/png/webp, máx 2MB)' });

        const apiBase = process.env.API_URL || 'https://api.auralixpe.xyz';
        const avatarUrl = `${apiBase}/uploads/avatars/${file.filename}`;
        await HubUser.findByIdAndUpdate(user._id, { $set: { avatarUrl } });
        return res.json({ status: true, data: { avatarUrl } });
    }
};