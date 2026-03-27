import { Request, Response } from 'express';
import { HubUser } from '../../../Modules/Hub/Models';
import { sendWelcomeEmail } from '../../../Modules/Hub/Email';

export default {
    name: 'Hub Verify Email',
    path: '/hub/auth/verify-email',
    method: 'get',
    category: 'hub',
    execution: async (req: Request, res: Response) => {
        const { token } = req.query as { token: string };
        if (!token) return res.status(400).json({ status: false, msg: 'Token requerido' });

        const user = await HubUser.findOne({ emailVerifyToken: token, emailVerifyExpiry: { $gt: new Date() } });
        if (!user) return res.status(400).json({ status: false, msg: 'Token inválido o expirado' });

        user.emailVerified = true;
        user.emailVerifyToken = undefined;
        user.emailVerifyExpiry = undefined;
        await user.save();

        if (user && user.email) sendWelcomeEmail(user.email).catch(e => console.error('[Email]', e));
        return res.json({ status: true, msg: 'Email verificado correctamente' });
    }
};