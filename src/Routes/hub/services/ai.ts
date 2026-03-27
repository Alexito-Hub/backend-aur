import type { Request, Response } from 'express';
import Claude from '../../../Core/Scraper/claude';
import Colorize from '../../../Core/Scraper/colorize';
import DeepAI from '../../../Core/Scraper/deepai';
import KimiAI from '../../../Core/Scraper/kimiai';
import LlamaCoder from '../../../Core/Scraper/llamacode';
import NanoBanana from '../../../Core/Scraper/nanobanana';
import Photoroom from '../../../Core/Scraper/Photoroom';
import WinkAI, { TASK } from '../../../Core/Scraper/winkai';
import { hubAuthMiddleware } from '../middleware';
import fs from 'fs';
import path from 'path';

export default {
    name: 'Hub AI Services',
    path: '/hub/ai',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, query, url, chatId, prompt, imagePath, type } = req.body;

        try {
            switch (method) {
                case 'claude':
                    if (!query) return res.status(400).json({ status: false, msg: 'Query requerida.' });
                    const claudeRes = await Claude.chat(query);
                    return res.status(200).json({ status: true, data: claudeRes });

                case 'kimiai':
                    if (!query) return res.status(400).json({ status: false, msg: 'Query requerida.' });
                    const kimiRes = await KimiAI.chat(query, chatId || null);
                    return res.status(200).json({ status: true, data: kimiRes });

                case 'deepai':
                    if (!query) return res.status(400).json({ status: false, msg: 'Query requerida.' });
                    const deepRes = await DeepAI.chat(query, imagePath);
                    return res.status(200).json({ status: true, data: deepRes });

                case 'colorize':
                    if (!imagePath) return res.status(400).json({ status: false, msg: 'imagePath requerido.' });
                    const colorRes = await Colorize.process(imagePath);
                    return res.status(200).json({ status: true, data: { path: colorRes } });

                case 'remove-bg':
                    if (!imagePath) return res.status(400).json({ status: false, msg: 'imagePath requerido.' });
                    const bgRes = await Photoroom.removebg(imagePath);
                    res.set('Content-Type', 'image/png');
                    return res.send(bgRes);

                case 'upscale':
                    if (!imagePath) return res.status(400).json({ status: false, msg: 'imagePath requerido.' });
                    const initData = await WinkAI.init();
                    const upload = await WinkAI.uploadFile(imagePath);
                    const taskCfg = type === 'ultra' ? TASK.ULTRA_HD : TASK.HD;
                    const task = await WinkAI.submitTask(upload, taskCfg);
                    const result = await WinkAI.waitForResult(task);
                    return res.status(200).json({ status: true, data: result });

                case 'nanobanana':
                    if (!imagePath || !prompt) return res.status(400).json({ status: false, msg: 'imagePath y prompt requeridos.' });
                    const nanoRes = await NanoBanana.generate({ imagePath, prompt });
                    return res.status(200).json({ status: true, data: nanoRes });

                case 'llamacoder':
                    // LlamaCoder en el scraper actual solo tiene upload, se usa para subir imagenes para otros modelos
                    if (!req.file) return res.status(400).json({ status: false, msg: 'Archivo requerido.' });
                    const llamaRes = await LlamaCoder.upload(req.file.buffer, req.file.originalname);
                    return res.status(200).json({ status: true, data: { url: llamaRes } });

                default:
                    return res.status(400).json({ 
                        status: false, 
                        msg: 'Modelo/Método AI no válido.' 
                    });
            }
        } catch (e: any) {
            console.error(`[Hub-AI] Error en ${method}:`, e);
            return res.status(500).json({ status: false, msg: `Error en servicio AI (${method}).`, error: e.message });
        }
    }
};
