import type { Request, Response } from 'express';
import OpenFoodFacts from '../../../Core/Scraper/openfoodfacts';
import { hubAuthMiddleware } from '../middleware';

export default {
    name: 'Hub Food Service',
    path: '/hub/food',
    method: 'post',
    category: 'hub',
    parameter: ['method'],
    premium: false,
    logger: true,
    requires: hubAuthMiddleware,
    execution: async (req: Request, res: Response) => {
        const { method, query, barcode, category, label, country, brand, nutriscore, page, pageSize } = req.body;

        try {
            let result;
            switch (method) {
                case 'search':
                    if (!query) return res.status(400).json({ status: false, msg: 'Query requerida.' });
                    result = await OpenFoodFacts.search(query, page, pageSize);
                    break;
                case 'barcode':
                    if (!barcode) return res.status(400).json({ status: false, msg: 'Barcode requerido.' });
                    result = await OpenFoodFacts.barcode(barcode);
                    break;
                case 'category':
                    if (!category) return res.status(400).json({ status: false, msg: 'Categoría requerida.' });
                    result = await OpenFoodFacts.category(category, page, pageSize);
                    break;
                case 'label':
                    if (!label) return res.status(400).json({ status: false, msg: 'Etiqueta requerida.' });
                    result = await OpenFoodFacts.label(label, page, pageSize);
                    break;
                case 'country':
                    if (!country) return res.status(400).json({ status: false, msg: 'País requerido.' });
                    result = await OpenFoodFacts.country(country, page, pageSize);
                    break;
                case 'brand':
                    if (!brand || !category) return res.status(400).json({ status: false, msg: 'Marca y categoría requeridas.' });
                    result = await OpenFoodFacts.brand(brand, category, page, pageSize);
                    break;
                case 'nutriscore':
                    if (!country || !nutriscore) return res.status(400).json({ status: false, msg: 'País y nutriscore requeridos.' });
                    result = await OpenFoodFacts.nutriscore(country, nutriscore, page, pageSize);
                    break;
                default:
                    return res.status(400).json({ status: false, msg: 'Método no válido.' });
            }

            if (!result.status) return res.status(404).json({ status: false, msg: result.error || 'No se encontraron resultados.' });
            return res.status(200).json({ status: true, data: result.data });

        } catch (e: any) {
            console.error(`[Hub-Food] Error:`, e);
            return res.status(500).json({ status: false, msg: `Error en servicio de alimentos.`, error: e.message });
        }
    }
};
