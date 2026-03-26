import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.sendgrid.net';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || 'apikey';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@auralixpe.xyz';
const FROM_NAME = process.env.FROM_NAME || 'Auralix Hub';
const APP_URL = process.env.APP_URL || 'https://hub.auralixpe.xyz';

const _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
    if (!SMTP_PASS) {
        console.warn('[Email] SMTP not configured — skipping verification email');
        return;
    }
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
    await _transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to,
        subject: 'Verifica tu cuenta — Auralix Hub',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: 'Courier New', monospace; background: #0d1117; color: #e6edf3; margin: 0; padding: 40px 20px; }
  .card { max-width: 560px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 32px; }
  .brand { color: #58a6ff; font-size: 22px; font-weight: bold; margin-bottom: 8px; }
  .prompt { color: #58a6ff; margin-right: 6px; }
  pre { background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 16px; overflow-x: auto; }
  a.btn { display: inline-block; background: #58a6ff; color: #0d1117; text-decoration: none;
          padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 20px 0; font-family: monospace; }
  .muted { color: #7d8590; font-size: 12px; margin-top: 24px; }
</style></head>
<body>
  <div class="card">
    <div class="brand">>_ Auralix Hub</div>
    <p><span class="prompt">$</span> verify-email --user="${to}"</p>
    <p>Tu cuenta ha sido creada. Haz clic en el botón para verificar tu correo y activar tus <strong>30 solicitudes gratuitas</strong>:</p>
    <a href="${verifyUrl}" class="btn">[Verificar mi cuenta]</a>
    <pre>hub.auralixpe.xyz/verify-email?token=${token.slice(0, 16)}...</pre>
    <p class="muted">Este enlace expira en 24 horas. Si no creaste esta cuenta, ignora este mensaje.<br>
    © ${new Date().getFullYear()} Auralix — api.auralixpe.xyz</p>
  </div>
</body>
</html>`,
        text: `Verifica tu cuenta en Auralix Hub:\n\n${verifyUrl}\n\nEl enlace expira en 24 horas.`,
    });
}

export async function sendWelcomeEmail(to: string): Promise<void> {
    if (!SMTP_PASS) return;
    await _transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to,
        subject: '¡Bienvenido a Auralix Hub!',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: 'Courier New', monospace; background: #0d1117; color: #e6edf3; margin: 0; padding: 40px 20px; }
  .card { max-width: 560px; margin: 0 auto; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 32px; }
  .brand { color: #58a6ff; font-size: 22px; font-weight: bold; }
  .green { color: #3fb950; }
  .btn { display: inline-block; background: #3fb950; color: #0d1117; text-decoration: none;
         padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 20px 0; }
  .muted { color: #7d8590; font-size: 12px; }
</style></head>
<body>
  <div class="card">
    <div class="brand">>_ Auralix Hub</div>
    <p class="green">[OK] Email verificado — cuenta activada</p>
    <p>Bienvenido. Tienes <strong>30 solicitudes</strong> listas para usar:</p>
    <ul><li>20 solicitudes de API</li><li>10 créditos de sandbox</li></ul>
    <a href="${APP_URL}/dashboard" class="btn">→ Ir al dashboard</a>
    <p class="muted">© ${new Date().getFullYear()} Auralix — hub.auralixpe.xyz</p>
  </div>
</body>
</html>`,
    });
}
