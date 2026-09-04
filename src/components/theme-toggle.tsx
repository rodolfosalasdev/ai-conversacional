"use client";

import { useEffect, useState } from "react";
import { Flashlight, FlashlightOff } from "lucide-react";

import { useTheme } from "@/components/providers";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // O tema real só é conhecido no cliente; até montar, o ícone precisa ser
  // estável para não quebrar a hidratação.
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={!mounted}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Flashlight className="size-4" aria-hidden />
      ) : (
        <FlashlightOff className="size-4" aria-hidden />
      )}
    </Button>
  );
}
