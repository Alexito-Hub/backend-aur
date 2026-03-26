import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { HubSnippet } from '../../../Modules/Hub/Models';

export default {
    name: 'Hub View Snippet', path: '/api/hub/snippets/:id/view', method: 'post', category: 'hub',
    execution: async (req: Request, res: Response) => {
        const { id } = req.params; const { password } = req.body || {};
        const snippet = await HubSnippet.findOne({ shortId: id });
        if (!snippet) return res.status(404).json({ status: false, msg: 'Snippet no encontrado' });

        if (snippet.passwordHash) {
            if (!password) return res.status(401).json({ status: false, requiresPassword: true, msg: 'Contraseña requerida' });
            const match = await bcrypt.compare(password, snippet.passwordHash);
            if (!match) return res.status(401).json({ status: false, msg: 'Contraseña incorrecta' });
        }

        snippet.viewCount += 1; await snippet.save();
        return res.json({ status: true, data: { title: snippet.title, language: snippet.language, code: snippet.code, viewCount: snippet.viewCount } });
    }
};