import { Check, Copy, KeyRound, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { TFunction } from "../i18n";
import { Modal } from "./Modal";

interface RecoveryModalProps {
  t: TFunction;
  code: string;
  onDone: () => void;
}

export function RecoveryModal({ t, code, onDone }: RecoveryModalProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  };

  return (
    <Modal
      title={t("recoveryTitle")}
      t={t}
      onClose={onDone}
      size="small"
      footer={
        <button className="button button--primary" type="button" onClick={onDone}>
          {t("done")}
        </button>
      }
    >
      <div className="recovery-warning">
        <ShieldAlert size={24} aria-hidden="true" />
        <p>{t("recoveryBody")}</p>
      </div>
      <div className="recovery-code">
        <KeyRound size={20} aria-hidden="true" />
        <code>{code}</code>
      </div>
      <button className="button button--secondary button--full" type="button" onClick={copy}>
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {copied ? t("codeCopied") : t("copyCode")}
      </button>
    </Modal>
  );
}
