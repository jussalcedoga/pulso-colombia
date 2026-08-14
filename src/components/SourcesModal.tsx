import { ArrowUpRight, Satellite, ShieldCheck, UsersRound } from "lucide-react";
import { formatDateTime } from "../format";
import type { TFunction } from "../i18n";
import type { HazardResponse, Language } from "../types";
import { Modal } from "./Modal";

interface SourcesModalProps {
  t: TFunction;
  language: Language;
  hazards: HazardResponse | null;
  onClose: () => void;
}

export function SourcesModal({ t, language, hazards, onClose }: SourcesModalProps) {
  return (
    <Modal title={t("liveSources")} t={t} onClose={onClose} size="medium">
      <section className="source-section">
        <h3>{t("dataSources")}</h3>
        <div className="source-entry">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>USGS</strong>
            <p>{t("usgsSource")}</p>
            {hazards ? (
              <span>{t("updated")}: {formatDateTime(hazards.source.updatedAt, language)}</span>
            ) : null}
          </div>
        </div>
        <div className="source-entry">
          <Satellite size={20} aria-hidden="true" />
          <div>
            <strong>NASA EOSDIS GIBS / VIIRS</strong>
            <p>{t("nasaSource")}</p>
            {hazards ? <span>{hazards.satellite.resolutionNote}</span> : null}
          </div>
        </div>
        <div className="source-entry">
          <UsersRound size={20} aria-hidden="true" />
          <div>
            <strong>{t("evidenceCommunity")}</strong>
            <p>{t("communitySource")}</p>
          </div>
        </div>
      </section>
      <section className="source-section">
        <h3>{t("methodology")}</h3>
        <p>{t("methodologyBody")}</p>
      </section>
      <section className="source-section source-section--warning">
        <h3>{t("limitations")}</h3>
        <p>{t("limitationsBody")}</p>
      </section>
      {hazards ? (
        <a className="button button--secondary button--full" href={hazards.event.url} target="_blank" rel="noreferrer">
          {t("openOfficialSource")}
          <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      ) : null}
    </Modal>
  );
}
