import { useEffect, useRef } from "react";
import type { Language } from "../types";

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: "interaction-only";
      language: Language;
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileWidgetProps {
  siteKey: string | null;
  action: "register" | "report";
  language: Language;
  label: string;
  resetSignal: number;
  onTokenChange: (token: string) => void;
  onUnavailable: () => void;
}

const SCRIPT_ID = "cloudflare-turnstile-script";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const ready = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable"));
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey,
  action,
  language,
  label,
  resetSignal,
  onTokenChange,
  onUnavailable
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenCallbackRef = useRef(onTokenChange);
  const unavailableCallbackRef = useRef(onUnavailable);

  useEffect(() => {
    tokenCallbackRef.current = onTokenChange;
    unavailableCallbackRef.current = onUnavailable;
  }, [onTokenChange, onUnavailable]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let disposed = false;
    tokenCallbackRef.current("");

    void loadTurnstile()
      .then((turnstile) => {
        if (disposed || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          language,
          size: "flexible",
          callback: (token) => tokenCallbackRef.current(token),
          "expired-callback": () => tokenCallbackRef.current(""),
          "error-callback": () => {
            tokenCallbackRef.current("");
            unavailableCallbackRef.current();
          }
        });
      })
      .catch(() => unavailableCallbackRef.current());

    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [action, language, siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      tokenCallbackRef.current("");
    }
  }, [resetSignal]);

  if (!siteKey) return null;
  return <div className="turnstile-widget" ref={containerRef} aria-label={label} />;
}
