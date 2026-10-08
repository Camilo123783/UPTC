import React, { useState } from "react";
import AuthLayout from "./../Auth/AuthLayout";
import AuthInput from "./../Auth/AuthInput";
import AuthButton from "./../Auth/AuthButton";

import { BACKEND_URL } from "../../config/api";

const API_BASE_URL = BACKEND_URL;

const AuthForgotPassword = ({ onNavigate }) => {
  // Pasos: 'request_code', 'verify_code', 'reset_password'
  const [step, setStep] = useState("request_code");

  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [targetEmailMasked, setTargetEmailMasked] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);

  const getBaseUrl = () => {
    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ) {
      return "http://localhost:4004";
    }
    return BACKEND_URL || "https://uptc.onrender.com";
  };

  // ── 1. Solicitar código de 6 dígitos ──────────────────────────
  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!identifier) {
      setMessage("Por favor, ingresa tu correo electrónico o número de cédula.");
      return;
    }

    setIsSending(true);
    setIsWakingUp(false);
    setMessage("");

    const wakeupTimer = setTimeout(() => {
      setIsWakingUp(true);
    }, 3500);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, cedula: identifier }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearTimeout(wakeupTimer);
      setIsWakingUp(false);

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
        setTargetEmailMasked(data.targetEmail || identifier);
        setCode("");
        setMessage(
          data.message ||
            `Hemos enviado un código de verificación de 6 dígitos a tu correo ${data.targetEmail || ""}. Por favor revisa tu bandeja de entrada (y la carpeta de spam).`
        );
        setStep("verify_code");
      } else {
        setIsSuccess(false);
        setMessage(
          data.message ||
            "No se encontró ningún usuario registrado con el correo o número de cédula ingresado."
        );
      }
    } catch (err) {
      clearTimeout(timeoutId);
      clearTimeout(wakeupTimer);
      setIsWakingUp(false);
      console.error("Error al solicitar código:", err);
      setIsSuccess(false);
      if (err.name === "AbortError") {
        setMessage("El servidor tardó demasiado en responder. Por favor reintenta en unos instantes.");
      } else {
        setMessage("No se pudo conectar con el servidor. Asegúrate de que esté activo.");
      }
    } finally {
      setIsSending(false);
    }
  };

  // ── 2. Verificar código de 6 dígitos ──────────────────────────
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      setMessage("Por favor, ingresa el código de 6 dígitos.");
      return;
    }

    setIsSending(true);
    setMessage("");

    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/verify-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
        setMessage("Código verificado exitosamente. Ahora ingresa tu nueva contraseña.");
        setStep("reset_password");
      } else {
        setIsSuccess(false);
        setMessage(data.message || "Código incorrecto o expirado.");
      }
    } catch (err) {
      console.error("Error al verificar código:", err);
      setIsSuccess(false);
      setMessage("Error al conectar con el servidor.");
    } finally {
      setIsSending(false);
    }
  };

  // ── 3. Establecer nueva contraseña ────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setMessage("La nueva contraseña debe tener al menos 4 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Las contraseñas no coinciden. Por favor verifícalas.");
      return;
    }

    setIsSending(true);
    setMessage("");

    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code, newPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
        setMessage(
          "¡Tu contraseña ha sido actualizada con éxito! Redirigiendo al inicio de sesión..."
        );
        setTimeout(() => {
          onNavigate("login");
        }, 2000);
      } else {
        setIsSuccess(false);
        setMessage(data.message || "No se pudo actualizar la contraseña.");
      }
    } catch (err) {
      console.error("Error al restablecer clave:", err);
      setIsSuccess(false);
      setMessage("Error al conectar con el servidor.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AuthLayout title="Recuperar Contraseña">
      {/* ── PASO 1: Solicitar código ── */}
      {step === "request_code" && (
        <form onSubmit={handleRequestCode}>
          <p className="text-center text-gray-600 mb-6 text-sm">
            Ingresa tu <strong>correo electrónico</strong> o{" "}
            <strong>número de cédula</strong>. Si tu cuenta existe, te enviaremos un{" "}
            <strong>código de verificación de 6 dígitos</strong> a tu correo.
          </p>

          <AuthInput
            id="identifier"
            type="text"
            label="Correo Electrónico o Cédula"
            placeholder="ejemplo@uptc.edu.co o 1012345678"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={isSending}
            required
          />

          {message && (
            <div
              className={`p-3 my-4 rounded-lg text-xs font-medium text-center ${
                isSuccess
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message}
            </div>
          )}

          {isWakingUp && (
            <div className="mb-3 p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs text-center animate-pulse">
              ⏳ Conectando con el servidor en la nube... Esto puede tomar unos segundos.
            </div>
          )}

          <AuthButton type="submit" disabled={isSending}>
            {isSending ? "Buscando y Enviando Código..." : "Enviar Código de Verificación"}
          </AuthButton>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                if (!identifier) {
                  setMessage("Ingresa tu correo o cédula arriba y luego haz clic aquí para validar tu código.");
                  return;
                }
                setTargetEmailMasked(identifier);
                setMessage("");
                setStep("verify_code");
              }}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 transition underline cursor-pointer"
            >
              ¿Ya recibiste tu código en el correo? Ingrésalo aquí →
            </button>
          </div>
        </form>
      )}

      {/* ── PASO 2: Verificar código de 6 dígitos ── */}
      {step === "verify_code" && (
        <form onSubmit={handleVerifyCode}>
          <p className="text-center text-gray-600 mb-6 text-sm">
            Se ha enviado un código de 6 dígitos a <strong>{targetEmailMasked}</strong>.
            Ingrésalo a continuación (válido por 15 minutos):
          </p>

          <AuthInput
            id="code"
            type="text"
            label="Código de Verificación (6 dígitos)"
            placeholder="Ej: 849201"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            disabled={isSending}
            required
          />

          {message && (
            <div
              className={`p-3 my-4 rounded-lg text-xs font-medium text-center ${
                isSuccess
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message}
            </div>
          )}

          <AuthButton type="submit" disabled={isSending}>
            {isSending ? "Verificando..." : "Verificar Código"}
          </AuthButton>

          <button
            type="button"
            onClick={() => {
              setStep("request_code");
              setMessage("");
            }}
            className="w-full mt-3 py-2 text-xs text-gray-500 hover:text-gray-700 text-center"
          >
            ← Volver a ingresar correo/cédula
          </button>
        </form>
      )}

      {/* ── PASO 3: Establecer nueva contraseña ── */}
      {step === "reset_password" && (
        <form onSubmit={handleResetPassword}>
          <p className="text-center text-gray-600 mb-6 text-sm">
            Ingresa tu <strong>nueva contraseña</strong> para actualizar el acceso a tu cuenta:
          </p>

          <AuthInput
            id="newPassword"
            type="password"
            label="Nueva Contraseña"
            placeholder="Mínimo 4 caracteres"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isSending}
            required
          />

          <AuthInput
            id="confirmPassword"
            type="password"
            label="Confirmar Nueva Contraseña"
            placeholder="Repite la nueva contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSending}
            required
          />

          {message && (
            <div
              className={`p-3 my-4 rounded-lg text-xs font-medium text-center ${
                isSuccess
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {message}
            </div>
          )}

          <AuthButton type="submit" disabled={isSending}>
            {isSending ? "Actualizando Contraseña..." : "Guardar Nueva Contraseña"}
          </AuthButton>
        </form>
      )}

      <p className="text-center text-sm text-gray-600 mt-6">
        <button
          onClick={() => onNavigate("login")}
          className="text-blue-600 hover:text-blue-800 font-medium transition duration-200 ease-in-out"
        >
          Volver al inicio de sesión
        </button>
      </p>
    </AuthLayout>
  );
};

export default AuthForgotPassword;
