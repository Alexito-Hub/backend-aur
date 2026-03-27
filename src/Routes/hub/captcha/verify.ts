import { Request, Response } from 'express';
import { HubCaptcha } from '../../../Modules/Hub/Models';
import { captchaLimiter } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub Captcha Verify',
    path: '/hub/captcha/verify',
    method: 'post',
    category: 'hub',
    validator: [captchaLimiter],
    execution: async (req: Request, res: Response) => {
        const { challengeId, answer } = req.body;
        if (!challengeId || answer === undefined) return res.status(400).json({ status: false, msg: 'Faltan parámetros' });
        
        const captcha = await HubCaptcha.findOne({ challengeId, used: false, expiresAt: { $gt: new Date() } });
        if (!captcha) return res.status(400).json({ status: false, msg: 'Captcha inválido o expirado' });
        
        if (captcha.answer !== String(answer).toLowerCase().trim()) {
            captcha.used = true; await captcha.save();
            return res.status(400).json({ status: false, msg: 'Respuesta incorrecta' });
        }

        // Keep captcha unused until it's consumed by login/register.
        // This allows the frontend to verify it first and then submit the token.
        return res.json({ status: true, msg: 'Captcha válido', data: { token: captcha.challengeId } });
    }
};