import { Request, Response } from 'express';
import { HubSnippet } from '../../../Modules/Hub/Models';
import { hubAuthMiddleware } from '../../../Modules/Hub/Middleware';

export default {
    name: 'Hub Delete Snippet', path: '/api/hub/snippets/:id', method: 'delete', category: 'hub',
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const user = (req as any).hubUser;
        const deleted = await HubSnippet.findOneAndDelete({ shortId: req.params.id, userId: user._id });
        if (!deleted) return res.status(404).json({ status: false, msg: 'No encontrado' });
        return res.json({ status: true, msg: 'Snippet eliminado' });
    }
};