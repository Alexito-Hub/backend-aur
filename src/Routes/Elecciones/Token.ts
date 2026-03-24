import { Request, Response } from 'express';
import Service from '../../Modules/Elecciones/Service';
import Token from '../../Core/Middleware/Token';

export default {
    name: 'Token',
    path: '/api/token',
    method: 'get',
    category: 'Elecciones',
    validator: Token.token,
    execution: async (req: Request, res: Response) => {
        return res.json({ token: Service.tk() });
    }
};
