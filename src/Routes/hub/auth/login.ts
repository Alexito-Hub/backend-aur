import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { HubUser, HubCaptcha } from '../../../Modules/Hub/Models';
import { authLimiter } from '../../../Modules/Hub/Middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'hub_dev_secret_change_me';
const JWT_EXPIRES = '15m';
const REFRESH_EXPIRES = '7d';

export default {
    name: 'Hub Login',
    path: '/hub/auth/login',
    method: 'post',
    category: 'hub',
    validator: [authLimiter],
    execution: async (req: Request, res: Response) => {
        const { email, password, captchaToken } = req.body;
        if (!email || !password || !captchaToken) return res.status(400).json({ status: false, msg: 'Faltan credenciales o captcha' });

        const captcha = await HubCaptcha.findOne({ challengeId: captchaToken, used: false, expiresAt: { $gt: new Date() } });
        if (!captcha) return res.status(400).json({ status: false, msg: 'Captcha inválido o expirado' });
        captcha.used = true; await captcha.save();

        const user = await HubUser.findOne({ email });
        if (!user) return res.status(401).json({ status: false, msg: 'Credenciales inválidas' });

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return res.status(401).json({ status: false, msg: 'Credenciales inválidas' });

        const token = jwt.sign({ sub: (user as any)._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        const refreshToken = jwt.sign({ sub: (user as any)._id.toString() }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES });

        res.cookie('hub_refresh', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
        
        const { passwordHash, emailVerifyToken, emailVerifyExpiry, __v, ...safe } = user.toObject ? user.toObject() : user;
        return res.json({ status: true, token, data: safe });
    }
};