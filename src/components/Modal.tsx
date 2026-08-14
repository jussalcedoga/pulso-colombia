import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import type { TFunction } from "../i18n";

interface ModalProps {
  title: string;
  t: TFunction;
  onClose: () => void;
  children: ReactNode;
  size?: "small" | "medium" | "large";
  footer?: ReactNode;
}

export function Modal({
  title,
  t,
  onClose,
  children,
  size = "medium",
  footer
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("close")} title={t("close")}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
