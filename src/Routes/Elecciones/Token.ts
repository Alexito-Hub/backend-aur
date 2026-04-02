import { Request, Response } from 'express';
import Service from '../../Modules/Elecciones/Service';
import Token from '../../Core/Middleware/Token';

export default {
    name: 'Token',
    path: '/elecciones/token',
    method: 'get',
    category: 'Elecciones',
    enable: false,
    validator: Token.token,
    execution: async (req: Request, res: Response) => {
        return res.json({ token: Service.tk() });
    }
};
