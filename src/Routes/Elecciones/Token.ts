import { Request, Response } from 'express';
import Srv from '../../Utils/Elecciones/Elecciones';
import AppToken from '../../Middleware/appToken';

export default {
    name: 'Token',
    path: '/api/token',
    method: 'get',
    category: 'Elecciones',
    validator: AppToken.token,
    execution: async (req: Request, res: Response) => {
        return res.json({ token: Srv.tk() });
    }
};
