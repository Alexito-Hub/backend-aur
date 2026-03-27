import { Request, Response } from 'express';
import Cache from '../../Core/System/Cache';
import Token from '../../Core/Middleware/Token';
import Bot from '../../Core/Middleware/Bot';
import Service from '../../Modules/Elecciones/Service';

export default {
    name: 'Resultados',
    path: '/api/resultados',
    method: 'get',
    category: 'Elecciones',
    enable: false,
    validator: [Token.token, Bot.detect],
    execution: async (req: Request, res: Response) => {
        try {
            const cached = Cache.get('elecciones_resultados');
            if (cached) return res.json({ status: true, data: cached });
            const data = await Service.res();
            Cache.set('elecciones_resultados', data, 30);
            return res.json({ status: true, data });
        } catch (e) {
            return res.status(500).json({ status: false, msg: 'Error de servidor.' });
        }
    }
};
