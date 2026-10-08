// utils/emailService.js

// Esta es una simulación de un servicio de envío de correos electrónicos.
// En una aplicación real, esto se conectaría a un proveedor de servicios de correo
// como SendGrid, Mailgun, Nodemailer (para Node.js), etc.

export const sendEmail = async (to, subject, body) => {
  return new Promise((resolve, reject) => {
    // Simulación de una llamada a la API de envío de correo
    console.log('--- SIMULACIÓN DE ENVÍO DE CORREO ---');
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log(`Cuerpo: ${body}`);
    console.log('------------------------------------');

    // Simular un retraso de red
    setTimeout(() => {
      const success = Math.random() > 0.1; // 90% de éxito, 10% de falla

      if (success) {
        console.log(`Correo enviado con éxito a ${to}`);
        resolve({ success: true, message: `Correo enviado a ${to}` });
      } else {
        console.error(`Fallo al enviar correo a ${to}`);
        reject({ success: false, message: `Fallo al enviar correo a ${to}` });
      }
    }, 1000); // Simula 1 segundo de latencia
  });
};

// Ejemplo de uso (no se incluye en el código de la app, solo para referencia)
/*
import { sendEmail } from './utils/emailService';

// En algún componente o función:
const handleSendNotification = async () => {
  try {
    await sendEmail(
      'estudiante@example.com',
      'Notificación de Práctica',
      'Tu práctica en el Hospital Central ha sido aprobada.'
    );
    alert('Notificación enviada con éxito.');
  } catch (error) {
    alert(`Error al enviar notificación: ${error.message}`);
  }
};
*/