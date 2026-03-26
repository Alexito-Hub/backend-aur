import type { Request, Response } from 'express';
import Photoroom from '../../../Core/Scraper/Photoroom';
import Middlewares from '../middlewares';

export default {
    name: 'Photoroom Remove Background',
    path: '/tools/photoroom',
    method: 'post',
    category: 'tools',
    example: {
        url: '/tools/photoroom',
        body: { image_path: '/path/to/image.png' }
    },
    parameter: ['image_path'],
    premium: false,
    error: false,
    logger: true,
    requires: (req: Request, res: Response, next: Function) => {
        const imagePath = req.body?.image_path || req.query?.image_path;
        if (!imagePath || typeof imagePath !== 'string') {
            return res.status(400).json({ status: false, msg: 'La ruta de la imagen es requerida' });
        }
        next();
    },
    validator: Middlewares.guest('photoroom'),
    execution: async (req: Request, res: Response) => {
        const { image_path, token } = req.body;

        try {
            const bufferResult = await Photoroom.removebg(image_path, token);

            res.status(200)
                .type('image/png')
                .set('Content-Disposition', `attachment; filename="photoroom_no_bg.png"`)
                .set('Cache-Control', 'no-store');
            return res.send(bufferResult);

        } catch (e: any) {
            console.error('Error en Photoroom:', e);
            return res.status(500).json({
                status: false,
                msg: e.message || 'Error interno del servidor.'
            });
        }
    }
};
