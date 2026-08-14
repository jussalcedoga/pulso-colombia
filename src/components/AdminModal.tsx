import { MapPin, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { api, ApiRequestError } from "../api";
import { CITIES } from "../data";
import { formatRelativeTime } from "../format";
import type { TFunction } from "../i18n";
import type { Language, PostType, Report } from "../types";
import { Modal } from "./Modal";

interface AdminModalProps {
  t: TFunction;
  language: Language;
  reports: Report[];
  onClose: () => void;
  onDeleted: (message: string) => Promise<void> | void;
}

function postTypeLabel(postType: PostType, t: TFunction): string {
  if (postType === "offer") return t("offerPost");
  if (postType === "update") return t("updatePost");
  return t("needPost");
}

export function AdminModal({
  t,
  language,
  reports,
  onClose,
  onDeleted
}: AdminModalProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const remove = async (reportId: string) => {
    setBusyId(reportId);
    setError("");
    try {
      await api.deleteReport(reportId);
      setConfirmingId(null);
      await onDeleted(t("postDeleted"));
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title={t("adminTitle")} t={t} onClose={onClose} size="large">
      <div className="admin-intro">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>{t("adminIntro")}</p>
      </div>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {reports.length ? (
        <div className="admin-report-list">
          {reports.map((report) => {
            const city = CITIES.find((item) => item.id === report.city);
            const cityName = language === "es" ? city?.name : city?.nameEn;
            return (
              <article key={report.id} className="admin-report">
                <header>
                  <span className={`post-type-badge post-type-badge--${report.postType}`}>
                    {postTypeLabel(report.postType, t)}
                  </span>
                  <time dateTime={report.createdAt}>
                    {formatRelativeTime(report.createdAt, language, t)}
                  </time>
                </header>
                <p>{report.details}</p>
                <div className="admin-report__meta">
                  <span>
                    <MapPin size={14} aria-hidden="true" />
                    {report.neighborhood || cityName}
                  </span>
                  <span>
                    <UserRound size={14} aria-hidden="true" />
                    {t("adminPostBy", { name: report.author.displayName })}
                  </span>
                </div>
                {confirmingId === report.id ? (
                  <div className="admin-report__confirm" role="alert">
                    <span>{t("deletePostWarning")}</span>
                    <div>
                      <button
                        className="button button--secondary"
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => setConfirmingId(null)}
                      >
                        {t("cancel")}
                      </button>
                      <button
                        className="button button--danger"
                        type="button"
                        disabled={busyId === report.id}
                        onClick={() => void remove(report.id)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        {t("deletePermanently")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="text-button text-button--danger admin-report__delete"
                    type="button"
                    onClick={() => setConfirmingId(report.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {t("deletePost")}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <ShieldCheck size={28} aria-hidden="true" />
          <strong>{t("noAdminPosts")}</strong>
        </div>
      )}
    </Modal>
  );
}
