// ============================================================
// config/mailer.js — Servicio de Envío de Correos (Resend + Nodemailer)
// Optimizado para Render Cloud (HTTPS puerto 443) y Desarrollo Local
// ============================================================
"use strict";

const nodemailer = require("nodemailer");
const { Resend } = require("resend");

/**
 * Crea el transporter de Nodemailer con timeouts estrictos para entorno local.
 */
function createTransporter() {
  const user = (process.env.SMTP_USER || "enfermeriauptc2026@gmail.com").trim();
  const pass = (process.env.SMTP_PASS || "").trim();

  const timeoutOptions = {
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 5000,
  };

  if (user.endsWith("@gmail.com") || !process.env.SMTP_HOST || process.env.SMTP_HOST.includes("gmail")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      ...timeoutOptions,
    });
  }

  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  let port = parseInt(process.env.SMTP_PORT || "465", 10);
  if (port === 587) port = 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    ...timeoutOptions,
  });
}

/**
 * Envía el correo automático con el código de 6 dígitos al correo del USUARIO.
 * Prioriza la API de Resend sobre HTTPS (puerto 443, no bloqueado por Render)
 * y usa Nodemailer SMTP como respaldo para desarrollo local.
 */
async function sendUserVerificationCodeEmail({ recipientEmail, fullName, code }) {
  const senderEmail = (process.env.SMTP_USER || "enfermeriauptc2026@gmail.com").trim();
  const subject = `🔑 Tu código de verificación UPTC es: ${code}`;

  const maskedEmail = recipientEmail.includes("@")
    ? recipientEmail.split("@")[0].slice(0, 2) + "***@" + recipientEmail.split("@")[1]
    : recipientEmail;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 22px;">🔑 Restablecer Contraseña UPTC</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px;">Gestión de Prácticas Universitarias</p>
      </div>
      
      <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hola <strong>${fullName}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Utiliza el siguiente código de verificación de 6 dígitos:
      </p>

      <div style="text-align: center; margin: 28px 0; padding: 18px; background-color: #f1f5f9; border-radius: 10px; border: 1px solid #cbd5e1;">
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2563eb;">${code}</span>
      </div>

      <p style="color: #64748b; font-size: 13px; text-align: center; margin-bottom: 20px;">
        ⏰ Este código expira en <strong>15 minutos</strong>. Si no solicitaste este cambio, puedes ignorar este mensaje.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Universidad Pedagógica y Tecnológica de Colombia — Este es un correo automático, por favor no lo respondas directamente.
      </p>
    </div>
  `;

  // Log seguro: nunca imprimir el código en texto plano
  console.log(`📧 Despachando código de verificación a ${maskedEmail} (${fullName})`);

  // ── 1. Enviar con Resend (API REST sobre HTTPS puerto 443 — Ideal para Render) ──
  if (process.env.RESEND_API_KEY) {
    try {
      console.log(`🌐 Enviando correo vía Resend API a ${maskedEmail}...`);
      const resend = new Resend(process.env.RESEND_API_KEY.trim());
      const fromEmail = (process.env.MAIL_FROM || "onboarding@resend.dev").trim();
      const fromFormatted = fromEmail.includes("<") ? fromEmail : `Soporte UPTC <${fromEmail}>`;

      const { data, error } = await resend.emails.send({
        from: fromFormatted,
        to: [recipientEmail],
        subject,
        html: htmlContent,
      });

      if (error) {
        console.warn("⚠️ Falló el envío con Resend:", error.message);
      } else {
        console.log(`✅ Correo entregado exitosamente vía Resend a ${maskedEmail} (ID: ${data?.id || "OK"})`);
        return { success: true, method: "resend", data };
      }
    } catch (resendErr) {
      console.warn("⚠️ Excepción en Resend API:", resendErr.message);
    }
  }

  // ── 2. Enviar con Brevo REST API (HTTPS puerto 443 — Alternativa sin bloqueo de Render) ──
  if (process.env.BREVO_API_KEY) {
    try {
      console.log(`🌐 Enviando correo vía Brevo API a ${maskedEmail}...`);
      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY.trim(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Soporte UPTC Prácticas",
            email: (process.env.MAIL_FROM || senderEmail).trim(),
          },
          to: [{ email: recipientEmail, name: fullName }],
          subject,
          htmlContent,
        }),
      });

      const brevoData = await brevoRes.json();
      if (brevoRes.ok) {
        console.log(`✅ Correo entregado exitosamente vía Brevo a ${maskedEmail} (ID: ${brevoData?.messageId || "OK"})`);
        return { success: true, method: "brevo", data: brevoData };
      } else {
        console.warn("⚠️ Falló el envío con Brevo API:", brevoData?.message || JSON.stringify(brevoData));
      }
    } catch (brevoErr) {
      console.warn("⚠️ Excepción en Brevo API:", brevoErr.message);
    }
  }

  // ── 3. Enviar con Nodemailer SMTP (Para entorno local) ──
  if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY && process.env.NODE_ENV === "production") {
    console.warn("⚠️ [AVISO RENDER] No se detectó RESEND_API_KEY en las variables de entorno. Render bloquea los puertos SMTP 465/587 con 'connect ENETUNREACH'. Añade RESEND_API_KEY en Render -> Environment para activar el envío por HTTPS puerto 443.");
  }

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"Soporte UPTC Prácticas" <${senderEmail}>`,
      to: recipientEmail,
      subject,
      html: htmlContent,
    });
    console.log(`✅ Correo entregado exitosamente vía Nodemailer SMTP a ${maskedEmail}`);
    return { success: true, messageId: info.messageId, method: "smtp" };
  } catch (err) {
    console.error("❌ Falló el envío con Nodemailer:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notificación copia opcional al Administrador (ejecutada en background).
 */
async function sendAdminForgotPasswordNotification({
  userInfo,
  role,
  programaOrInstitucion,
  requestEmail,
  code,
}) {
  const adminEmail = (process.env.ADMIN_EMAIL || "enfermeriauptc2026@gmail.com").trim();
  const fullName = `${userInfo.nombre || ""} ${userInfo.apellidos || ""}`.trim() || "Usuario UPTC";
  const cedula = userInfo.cedula !== undefined && userInfo.cedula !== null ? userInfo.cedula : "N/A";
  const userEmail = userInfo.correo_institucional || requestEmail;
  const program = programaOrInstitucion || "No especificado";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px; background-color: #ffffff;">
      <h3 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 0;">
        🔔 Solicitud Automática de Código de Recuperación
      </h3>
      <p style="color: #374151; font-size: 14px;">
        Un usuario solicitó restablecer su contraseña. Se le ha enviado un código de verificación de 6 dígitos:
      </p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px;">
        <tr style="background-color: #f8fafc;">
          <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0; width: 35%;">Nombre Completo:</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${fullName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Cédula:</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${cedula}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Rol:</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-transform: capitalize;">${role}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Programa / Institución:</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${program}</td>
        </tr>
        <tr style="background-color: #f8fafc;">
          <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Correo de Envío:</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0;"><a href="mailto:${userEmail}">${userEmail}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; border: 1px solid #e2e8f0;">Estado del Código:</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: #16a34a;">Generado y enviado al buzón privado del usuario (vigencia 15 min)</td>
        </tr>
      </table>
    </div>
  `;

  // 1. Probar Resend si está disponible
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY.trim());
      const fromEmail = (process.env.MAIL_FROM || "onboarding@resend.dev").trim();
      const fromFormatted = fromEmail.includes("<") ? fromEmail : `Sistema UPTC <${fromEmail}>`;

      await resend.emails.send({
        from: fromFormatted,
        to: [adminEmail],
        subject: `🚨 [Copia Registro] Recuperación de Clave: ${fullName} (${cedula})`,
        html: htmlContent,
      });
      return;
    } catch (e) {
      // Continuar a fallback
    }
  }

  // 2. Probar Brevo si está disponible
  if (process.env.BREVO_API_KEY) {
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": process.env.BREVO_API_KEY.trim(),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "Sistema UPTC",
            email: (process.env.MAIL_FROM || "enfermeriauptc2026@gmail.com").trim(),
          },
          to: [{ email: adminEmail, name: "Administrador UPTC" }],
          subject: `🚨 [Copia Registro] Recuperación de Clave: ${fullName} (${cedula})`,
          htmlContent,
        }),
      });
      return;
    } catch (e) {
      // Continuar a fallback
    }
  }

  // 3. Respaldo Nodemailer SMTP
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"Sistema UPTC" <${process.env.SMTP_USER || "enfermeriauptc2026@gmail.com"}>`,
      to: adminEmail,
      subject: `🚨 [Copia Registro] Recuperación de Clave: ${fullName} (${cedula})`,
      html: htmlContent,
    });
  } catch (err) {
    // Silencioso en background
  }
}

module.exports = {
  sendUserVerificationCodeEmail,
  sendAdminForgotPasswordNotification,
};
