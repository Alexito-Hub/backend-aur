import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { HubUser, HubCaptcha } from '../../../Modules/Hub/Models';
import { sendVerificationEmail } from '../../../Modules/Hub/Email';
import { authLimiter } from '../../../Modules/Hub/Middleware';
import crypto from 'crypto';

export default {
    name: 'Hub Register',
    path: '/hub/auth/register',
    method: 'post',
    category: 'hub',
    validator: [authLimiter],
    execution: async (req: Request, res: Response) => {
        const { email, password, displayName, captchaToken } = req.body;
        if (!email || !password || !captchaToken) return res.status(400).json({ status: false, msg: 'Faltan campos' });

        const captcha = await HubCaptcha.findOne({ challengeId: captchaToken, used: false, expiresAt: { $gt: new Date() } });
        if (!captcha) return res.status(400).json({ status: false, msg: 'Captcha inválido o expirado' });
        captcha.used = true; await captcha.save();

        if (password.length < 8) return res.status(400).json({ status: false, msg: 'La contraseña debe tener 8 caracteres min' });
        if (await HubUser.findOne({ email })) return res.status(400).json({ status: false, msg: 'El correo ya está registrado' });

        const passwordHash = await bcrypt.hash(password, 10);
        const emailVerifyToken = crypto.randomBytes(32).toString('hex');
        const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await HubUser.create({ email, passwordHash, displayName, emailVerifyToken, emailVerifyExpiry });
        sendVerificationEmail(user.email, emailVerifyToken).catch(e => console.error('[Email]', e));

        return res.status(201).json({ status: true, msg: 'Usuario registrado. Revisa tu correo.', data: { _id: user._id, email: user.email } });
    }
};