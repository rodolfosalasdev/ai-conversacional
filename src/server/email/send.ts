import { randomUUID } from "node:crypto";

import {
  contractHtml,
  contractSubject,
  contractText,
} from "@/server/contract/template";
import { saveContractDocument } from "@/server/store/conversation-store";
import { LENDER } from "@/lib/site-config";
import type { ClientProfile, Contract, EmailDelivery } from "@/lib/types/financing";

/**
 * Entrega a cópia do contrato. Tenta, nesta ordem:
 *   1. Resend        — se RESEND_API_KEY estiver definida
 *   2. SMTP          — se SMTP_HOST estiver definido (nodemailer)
 *   3. Ethereal      — caixa de teste online, se EMAIL_TRANSPORT=ethereal
 *   4. Preview local — sempre funciona, grava o HTML e devolve um link interno
 */
export async function deliverContractEmail(
  contract: Contract,
  client: ClientProfile
): Promise<EmailDelivery> {
  const subject = contractSubject(contract);
  const html = contractHtml(contract);
  const text = contractText(contract);
  const to = process.env.EMAIL_OVERRIDE_TO ?? client.email;
  const from = process.env.EMAIL_FROM ?? `${LENDER.name} <onboarding@resend.dev>`;

  await saveContractDocument({ id: contract.id, html, text, subject });

  const base: Omit<EmailDelivery, "transport" | "previewUrl"> = {
    id: randomUUID(),
    to,
    subject,
    sentAt: new Date().toISOString(),
  };

  const previewUrl = `/api/contracts/${contract.id}/preview`;

  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      });

      if (response.ok) {
        return { ...base, transport: "resend", previewUrl };
      }
    } catch {
      // Cai para o próximo transporte.
    }
  }

  if (process.env.SMTP_HOST || process.env.EMAIL_TRANSPORT === "ethereal") {
    try {
      const delivery = await sendWithNodemailer({
        from,
        to,
        subject,
        html,
        text,
      });
      return { ...base, ...delivery, previewUrl: delivery.previewUrl ?? previewUrl };
    } catch {
      // Cai para o preview local.
    }
  }

  return { ...base, transport: "preview", previewUrl };
}

async function sendWithNodemailer(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ transport: string; previewUrl?: string }> {
  const nodemailer = (await import("nodemailer")).default;

  if (process.env.EMAIL_TRANSPORT === "ethereal") {
    const account = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });

    const info = await transporter.sendMail(params);
    const url = nodemailer.getTestMessageUrl(info);

    return { transport: "ethereal", previewUrl: url ? String(url) : undefined };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transporter.sendMail(params);
  return { transport: "smtp" };
}
