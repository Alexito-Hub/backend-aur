import { Request, Response } from 'express';
import Cache from '../../Utils/System/cache';
import AppToken from '../../Middleware/appToken';
import AntiBot from '../../Middleware/antiBot';
import Srv from '../../Utils/Elecciones/Elecciones';

export default {
    name: 'Resultados',
    path: '/api/resultados',
    method: 'get',
    category: 'Elecciones',
    validator: [AppToken.token, AntiBot.detect],
    execution: async (req: Request, res: Response) => {
        try {
            const cached = Cache.get('elecciones_resultados');
            if (cached) return res.json({ status: true, data: cached });
            const data = await Srv.res();
            Cache.set('elecciones_resultados', data, 30);
            return res.json({ status: true, data });
        } catch (e) {
            return res.status(500).json({ status: false, msg: 'Error de servidor.' });
        }
    }
};
