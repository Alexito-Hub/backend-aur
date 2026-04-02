import { Request, Response } from 'express';
import crypto from 'crypto';
import { HubCaptcha } from '../../../Modules/Hub/Models';
import {
    captchaFraudLimiter,
    captchaLimiter,
    requireDeviceFingerprint,
} from '../../../Modules/Hub/Middleware';
import { CaptchaGen } from '../../../Utils/CaptchaGen';

export default {
    name: 'Hub Captcha Challenge',
    path: '/hub/captcha/challenge',
    method: 'post',
    category: 'hub',
    validator: [captchaLimiter, captchaFraudLimiter, requireDeviceFingerprint],
    execution: async (req: Request, res: Response) => {
        const { svg, text } = CaptchaGen.generate();
        const challengeId = crypto.randomBytes(16).toString('hex');

        await HubCaptcha.create({ challengeId, answer: String(text).toLowerCase(), expiresAt: new Date(Date.now() + 5 * 60 * 1000) });
        return res.json({ status: true, data: { challengeId, type: 'svg', payload: svg } });
    }
};