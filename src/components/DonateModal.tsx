import {
  ArrowRight,
  ArrowUpRight,
  HeartHandshake,
  Landmark,
  ShieldCheck,
  TriangleAlert
} from "lucide-react";
import { OFFICIAL_RESOURCES } from "../data";
import type { TFunction } from "../i18n";
import { Modal } from "./Modal";

interface DonateModalProps {
  t: TFunction;
  onClose: () => void;
  onBrowseNeeds: () => void;
  onPostAvailableHelp: () => void;
}

export function DonateModal({
  t,
  onClose,
  onBrowseNeeds,
  onPostAvailableHelp
}: DonateModalProps) {
  return (
    <Modal title={t("donateTitle")} t={t} onClose={onClose} size="medium">
      <p className="modal-intro">{t("donateIntro")}</p>
      <section className="donation-section">
        <h3><Landmark size={18} aria-hidden="true" />{t("officialOrganizations")}</h3>
        <div className="organization-list">
          {OFFICIAL_RESOURCES.map((resource) => (
            <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className="organization-row">
              <span className="organization-row__mark">
                <ShieldCheck size={19} aria-hidden="true" />
              </span>
              <span>
                <strong>{resource.name}</strong>
                <small>{resource.domain}</small>
              </span>
              <ArrowUpRight size={18} aria-label={t("externalLink")} />
            </a>
          ))}
        </div>
      </section>
      <section className="donation-section donation-section--direct">
        <h3><HeartHandshake size={18} aria-hidden="true" />{t("directSupport")}</h3>
        <p>{t("directSupportBody")}</p>
        <div className="donation-actions">
          <button className="button button--give" type="button" onClick={onBrowseNeeds}>
            {t("browseNeeds")}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <button className="button button--secondary" type="button" onClick={onPostAvailableHelp}>
            <HeartHandshake size={18} aria-hidden="true" />
            {t("postAvailableHelp")}
          </button>
        </div>
      </section>
      <div className="safety-callout">
        <TriangleAlert size={19} aria-hidden="true" />
        <span>{t("donationSafety")}</span>
      </div>
    </Modal>
  );
}
