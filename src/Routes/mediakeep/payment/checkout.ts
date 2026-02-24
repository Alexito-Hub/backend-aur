import { Request, Response } from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import Middlewares from '../middlewares';

/**
 * Controller strictly handling the generation of payment URLs
 * using the official MercadoPago SDK and Backend-enforced pricing.
 */
export default {
    path: '/payment/checkout',
    method: 'post',

    validator: Middlewares.pay,
    execute: async (req: Request, res: Response) => {
        try {
            // Expected payload from the Flutter app
            const { packageId, userId } = req.body;

            if (!userId || !packageId) {
                return res.status(400).json({ status: false, msg: 'Faltan parámetros de pago.' });
            }

            // Define exact Backend truth for pricing and limits (Anti-spoofing)
            const PACK_DICTIONARY: Record<string, { title: string, amount: number, requests: number, planType: string }> = {
                'pack_50': { title: 'Pack Básico (50 Descargas)', amount: 15, requests: 50, planType: 'premium' },
                'pack_100': { title: 'Pack Pro (100 Descargas)', amount: 25, requests: 100, planType: 'premium' },
                'sub_premium': { title: 'Auralix Premium Mensual', amount: 49, requests: 99999, planType: 'premium' }
            };

            const selectedPack = PACK_DICTIONARY[packageId];
            if (!selectedPack) {
                return res.status(400).json({ status: false, msg: 'Paquete de redención inválido.' });
            }

            // Initialize MercadoPago Client
            const accessToken = process.env.MP_ACCESS_TOKEN;
            if (!accessToken) {
                throw new Error('MercadoPago Access Token no configurado en el servidor.');
            }
            const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });

            const preference = new Preference(client);
            const response = await preference.create({
                body: {
                    items: [
                        {
                            id: packageId,
                            title: selectedPack.title,
                            unit_price: selectedPack.amount,
                            quantity: 1,
                            currency_id: 'MXN'
                        }
                    ],
                    metadata: {
                        user_id: userId,
                        package_requests: selectedPack.requests,
                        plan_type: selectedPack.planType,
                        expected_amount: selectedPack.amount // To cross-validate in webhook
                    },
                    back_urls: {
                        success: process.env.FRONTEND_URL || 'https://auralix.app/success',
                        failure: process.env.FRONTEND_URL || 'https://auralix.app/failure',
                        pending: process.env.FRONTEND_URL || 'https://auralix.app/pending'
                    },
                    auto_return: 'approved',
                    statement_descriptor: 'AURALIX PREMIUM'
                }
            });

            return res.status(200).json({
                status: true,
                init_point: response.init_point,
                preference_id: response.id
            });

        } catch (error: any) {
            console.error('Checkout Generation Error:', error);
            return res.status(500).json({ status: false, msg: 'Error generando link de pago.' });
        }
    }
};
