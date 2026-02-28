import { Request, Response } from 'express';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import admin from '../../../Config/firebase';
import crypto from 'crypto';
const db = admin.firestore();

/**
 * Controller strictly handling synchronous payment webhooks,
 * using the official MercadoPago SDK to verify real transactions and HMAC X-Signature.
 */
export default {
    path: '/payment/webhook',
    method: 'post',

    execution: async (req: Request, res: Response) => {
        try {
            // Immediate response required by MP
            res.status(200).send('OK');

            const { action, data, type } = req.body;

            // 1. Validate Cryptographic HMAC Signature to stop BIN injection/Spoofing
            const xSignature = req.headers['x-signature'] as string || '';
            const xRequestId = req.headers['x-request-id'] as string || '';
            const webhookSecret = process.env.MP_WEBHOOK_SECRET;

            if (webhookSecret && xSignature) {
                // The x-signature structure is usually ts=123,v1=hash
                const parts = xSignature.split(',');
                let ts = '';
                let v1 = '';

                parts.forEach(part => {
                    if (part.startsWith('ts=')) ts = part.substring(3);
                    if (part.startsWith('v1=')) v1 = part.substring(3);
                });

                if (ts && v1) {
                    // Reconstruct manifest string
                    const manifest = `id:${data?.id || ''};request-id:${xRequestId};ts:${ts};`;
                    const computedHash = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

                    if (computedHash !== v1) {
                        console.error(`Criptografía fallida: Tentativa de pago falso (ID: ${data?.id})`);
                        return;
                    }
                } else {
                    console.error('Firma incompleta en petición de MercadoPago.');
                    return;
                }
            }

            // MP Webhooks usually send action='payment.created' 
            if (action === 'payment.created' || action === 'payment.updated' || type === 'payment') {
                const paymentId = data?.id;
                if (!paymentId) return;

                // 2. Initialize MercadoPago SDK exactly to verify status and attributes
                const accessToken = process.env.MP_ACCESS_TOKEN;
                if (!accessToken) {
                    throw new Error('MercadoPago Access Token ausente para webhook.');
                }
                const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
                const paymentClient = new Payment(client);

                // Fetch trusting ONLY the backend secure connection
                const paymentData = await paymentClient.get({ id: paymentId });
                const status = paymentData.status;

                // Ensure it's approved and has metadata attached (sent during checkout)
                if (status === 'approved' && paymentData.metadata) {
                    const userId = paymentData.metadata.user_id;
                    const planType = paymentData.metadata.plan_type || 'premium';
                    const packageRequests = Number(paymentData.metadata.package_requests) || 0;
                    const expectedAmount = Number(paymentData.metadata.expected_amount) || 0;
                    const transactionAmount = Number(paymentData.transaction_amount) || 0;

                    if (!userId) {
                        console.error(`Pago aprobado ignorado: Sin UserID en metadatos (Pago ${paymentId})`);
                        return;
                    }

                    // 3. Strict match of expected dictionary amount vs what was charged
                    // This blocks users trying to trick MP by manually modifying preference HTML
                    if (transactionAmount < expectedAmount) {
                        console.error(`Hack attempt blocked: Amount short on payment ${paymentId}. Paid: ${transactionAmount}, Expected: ${expectedAmount}`);
                        return;
                    }

                    // 4. Process Firebase grant atomically with Idempotency
                    const userRef = db.collection('users').doc(userId);

                    await db.runTransaction(async (transaction: any) => {
                        const sfDoc = await transaction.get(userRef);
                        if (!sfDoc.exists) return; // User not found

                        // Double execution prevention check tracking processed payments
                        const paymentRef = db.collection('payments').doc(paymentId.toString());
                        const paymentDoc = await transaction.get(paymentRef);

                        if (paymentDoc.exists) {
                            console.log(`Pago ${paymentId} ya procesado anteriormente (Idempotencia DB activa).`);
                            return;
                        }

                        const currentData = sfDoc.data();
                        const currentLimit = currentData?.totalLimit || 10;

                        // For subscription plans, set expiry 30 days from now
                        // The totalLimit is set to a large number (99999) for unlimited
                        const isSub = planType === 'premium' && packageRequests >= 99999;
                        const subscriptionExpiresAt = isSub
                            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                            : (currentData?.subscriptionExpiresAt || null);

                        transaction.update(userRef, {
                            plan: planType,
                            // For subscriptions: reset to 99999 (not cumulative).
                            // For packs: accumulate on existing limit.
                            totalLimit: isSub ? 99999 : currentLimit + packageRequests,
                            lastPaymentId: paymentId,
                            subscriptionExpiresAt,
                            updatedAt: new Date().toISOString()
                        });

                        // Record payment to avoid duplicates
                        transaction.set(paymentRef, {
                            userId: userId,
                            amount: transactionAmount,
                            status: 'approved',
                            type: planType,
                            timestamp: new Date().toISOString(),
                            payment_method_id: paymentData.payment_method_id,
                            issuer_id: paymentData.issuer_id, // Logging issuer aids against BIN attacks
                            installments: paymentData.installments
                        });
                    });

                    console.log(`[SECURE] Pago procesado: +${packageRequests} descargas asignadas a UID: ${userId}`);
                } else if (status === 'rejected' || status === 'refunded') {
                    // Logic for chargebacks could go here gracefully reverting the totalLimit if needed
                    console.log(`Pago ${paymentId} estatus: ${status}`);
                }
            }

        } catch (error: any) {
            console.error('Payment Webhook Processing Error:', error);
            // Don't send 500 back to MP if we've already responded 200, log only.
        }
    }
};
