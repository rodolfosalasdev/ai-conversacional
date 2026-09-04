"use client";

import { useState } from "react";
import { Bot, Check, ChevronDown, Globe, ListTodo, MessageCircleQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MODE_CONFIG } from "@/lib/prompts/system";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/lib/types/chat";

const MODE_ICONS: Record<ChatMode, typeof Bot> = {
  agent: Bot,
  plan: ListTodo,
  ask: MessageCircleQuestion,
  web: Globe,
};

const MODES: ChatMode[] = ["agent", "plan", "ask", "web"];

export function ModeSwitcher({
  mode,
  onChange,
  disabled,
}: {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ActiveIcon = MODE_ICONS[mode];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            className="gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ActiveIcon className="size-3.5" aria-hidden />
            {MODE_CONFIG[mode].label}
            <ChevronDown className="size-3 opacity-60" aria-hidden />
          </Button>
        }
      />

      <PopoverContent align="start" className="w-72 p-1.5">
        {MODES.map((item) => {
          const Icon = MODE_ICONS[item];
          const isActive = item === mode;

          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-md p-2 text-left transition-colors",
                "hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                isActive && "bg-accent"
              )}
            >
              <Icon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  {MODE_CONFIG[item].label}
                  {isActive ? <Check className="size-3" aria-hidden /> : null}
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                  {MODE_CONFIG[item].hint}
                </span>
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
