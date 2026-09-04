import { NextResponse } from "next/server";

export function jsonOk<T>(data: T) {
  return NextResponse.json(data);
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function jsonMessage(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleRouteError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Erro inesperado no servidor.";

  if (process.env.NODE_ENV !== "production") {
    console.error("[api]", error);
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
