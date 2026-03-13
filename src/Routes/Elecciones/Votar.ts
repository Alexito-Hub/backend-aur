import { Request, Response } from 'express';
import crypto from 'crypto';
import AppToken from '../../Middleware/appToken';
import AntiBot from '../../Middleware/antiBot';
import Srv from '../../Utils/Elecciones/Elecciones';
import Sock from '../../Socket/Elecciones/Elecciones';

const hash = (d: string) => crypto.createHash('sha256').update(d).digest('hex');

export default {
    name: 'Votar',
    path: '/api/votar',
    method: 'post',
    category: 'Elecciones',
    parameter: ['token', 'candidato_id', 'fingerprint_cliente', 'nombre'],
    validator: [AppToken.token, AntiBot.detect],
    execution: async (req: Request, res: Response) => {
        try {
            const ip = (req as any).clientIp || req.socket.remoteAddress || '';
            const ua = req.headers['user-agent'] || '';
            const { token, candidato_id, fingerprint_cliente, nombre } = req.body;

            if (!Srv.vfy(token)) {
                await Srv.bad(ip);
                return res.status(403).json({ status: false, msg: 'Sesion invalida.' });
            }

            const name = (nombre || '').trim();
            if (!name || name.length > 50 || !/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]+$/.test(name)) {
                return res.status(400).json({ status: false, msg: 'Nombre invalido.' });
            }

            if (!(await Srv.ok(ip))) {
                return res.status(429).json({ status: false, msg: 'Bloqueo temporal.' });
            }

            const fp = hash(`${hash(`${ip}|${ua}|${req.headers['accept-language'] || ''}`)}|${fingerprint_cliente || ''}`);
            const ok = await Srv.vote(candidato_id, fp, ip, name);
            if (!ok.status) return res.status(409).json({ status: false, msg: ok.msg });

            Sock.update();
            return res.json({ status: true, msg: '¡Voto registrado!' });
        } catch (e) {
            return res.status(500).json({ status: false, msg: 'Error fatal.' });
        }
    }
};
