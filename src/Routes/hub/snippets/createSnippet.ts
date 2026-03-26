import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { HubSnippet } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub Create Snippet', path: '/api/hub/snippets', method: 'post', category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const { title, language = 'plaintext', code, password } = req.body;
        if (!title || !code) return res.status(400).json({ status: false, msg: 'title y code requeridos' });
        if (code.length > 200000) return res.status(400).json({ status: false, msg: 'Código demasiado largo (máx 200KB)' });

        const shortId = crypto.randomBytes(5).toString('hex');
        const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;
        const snippet = await HubSnippet.create({ userId: user._id, title: title.trim().substring(0, 200), language, code, shortId, passwordHash });
        return res.status(201).json({ status: true, data: { ...snippet.toObject(), hasPassword: !!passwordHash } });
    }
};