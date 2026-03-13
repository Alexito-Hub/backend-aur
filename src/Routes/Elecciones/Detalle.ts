import { Request, Response } from 'express';
import Srv from '../../Utils/Elecciones/Elecciones';
import AppToken from '../../Middleware/appToken';

export default {
    name: 'Detalle',
    path: '/api/candidato/:id',
    method: 'get',
    category: 'Elecciones',
    validator: AppToken.token,
    execution: async (req: Request, res: Response) => {
        try {
            const data = await Srv.det(req.params.id);
            return data ? res.json({ status: true, data }) : res.status(404).json({ status: false });
        } catch (e) {
            return res.status(500).json({ status: false });
        }
    }
};
