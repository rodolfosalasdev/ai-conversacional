import { randomUUID } from "node:crypto";

import { handleRouteError, jsonMessage, jsonOk } from "@/server/http/json";
import type { Attachment } from "@/lib/types/chat";

const MAX_SIZE = 10 * 1024 * 1024;
const TEXT_LIKE = ["text/", "application/json", "application/xml"];

/**
 * Recebe anexos do composer. Arquivos de texto viram trecho de contexto para o
 * modelo; binários (PDF, imagem) são registrados apenas como metadado.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) return jsonMessage("Nenhum arquivo enviado.", 400);

    const attachments: Attachment[] = [];

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return jsonMessage(`"${file.name}" excede o limite de 10 MB.`, 413);
      }

      const isTextLike = TEXT_LIKE.some((prefix) =>
        file.type.startsWith(prefix)
      );
      const excerpt = isTextLike
        ? (await file.text()).slice(0, 4000)
        : undefined;

      attachments.push({
        id: randomUUID(),
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        excerpt,
      });
    }

    return jsonOk({ attachments });
  } catch (error) {
    return handleRouteError(error);
  }
}
