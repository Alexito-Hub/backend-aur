import { Request, Response } from 'express';
import Service from '../../Modules/Elecciones/Service';
import Token from '../../Core/Middleware/Token';

export default {
    name: 'Detalle',
    path: '/api/candidato/:id',
    method: 'get',
    category: 'Elecciones',
    validator: Token.token,
    execution: async (req: Request, res: Response) => {
        try {
                const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
                const data = await Service.det(id);
            return data ? res.json({ status: true, data }) : res.status(404).json({ status: false });
        } catch (e) {
            return res.status(500).json({ status: false });
        }
    }
};
