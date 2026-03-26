import { Request, Response } from 'express';
import { HubUser } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub User Profile', path: '/api/hub/user/profile', method: 'put', category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const { displayName, language, theme } = req.body;
        const allowed: any = {};
        if (typeof displayName === 'string') allowed.displayName = displayName.slice(0, 60).trim();
        if (['es', 'en'].includes(language)) allowed.language = language;
        if (['tokyoNight', 'dracula', 'nord', 'monokaiPro', 'auralixDefault'].includes(theme)) allowed.theme = theme;

        const updated = await HubUser.findByIdAndUpdate(user._id, { $set: allowed }, { new: true }).lean() as any;
        if (!updated) return res.status(404).json({ status: false, msg: 'Usuario no encontrado' });

        const { passwordHash, emailVerifyToken, emailVerifyExpiry, __v, ...safe } = updated;
        return res.json({ status: true, data: safe });
    }
};