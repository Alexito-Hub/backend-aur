import { Request, Response } from 'express';
import Service from '../../Modules/Elecciones/Service';
import Sock from '../../Socket/Elecciones/Elecciones';
import Token from '../../Core/Middleware/Token';

export default {
    name: 'Reset',
    path: '/api/admin/reset',
    method: 'post',
    category: 'Elecciones',
    parameter: ['token'],
    premium: true,
    validator: Token.token,
    execution: async (req: Request, res: Response) => {
        try {
            const { token } = req.body;
            if (!process.env.APP_SECRET_TOKEN || token !== process.env.APP_SECRET_TOKEN) {
                return res.status(403).json({ status: false, msg: 'No autorizado.' });
            }
            await Service.rst();
            Sock.update();
            return res.json({ status: true, msg: 'Sistema reiniciado.' });
        } catch (e) {
            return res.status(500).json({ status: false, msg: 'Error fatal.' });
        }
    }
};
