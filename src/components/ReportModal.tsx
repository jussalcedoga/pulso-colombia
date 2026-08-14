import {
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Flag,
  Globe2,
  Handshake,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldAlert,
  Trash2,
  UsersRound
} from "lucide-react";
import { latLngToCell } from "h3-js";
import { useEffect, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../api";
import { CITIES, OFFER_TYPES } from "../data";
import { formatRelativeTime } from "../format";
import type { TFunction } from "../i18n";
import { sampleModeledMmi } from "../scoring";
import type {
  HazardResponse,
  Language,
  OfferType,
  Report,
  ReportComment,
  ReportStatus,
  User
} from "../types";
import { Modal } from "./Modal";
import { NeedIcon, OfferIcon } from "./NeedIcon";

interface ReportModalProps {
  t: TFunction;
  language: Language;
  report: Report;
  user: User | null;
  hazards: HazardResponse | null;
  onClose: () => void;
  onEdit: () => void;
  onRequireAuth: () => void;
  onConnectionCreated: (offerId: string, message: string) => void;
  onChanged: (message: string) => void;
}

function offerLabel(type: OfferType, t: TFunction): string {
  const keys: Record<OfferType, Parameters<TFunction>[0]> = {
    supplies: "offerSupplies",
    transport: "offerTransport",
    shelter: "offerShelter",
    medical: "offerMedical",
    volunteer: "offerVolunteer",
    funds: "offerFunds",
    other: "offerOther"
  };
  return t(keys[type]);
}

function connectionType(report: Report, selected: OfferType): OfferType {
  if (report.postType === "need") return selected;
  const firstType = report.needTypes[0];
  if (firstType === "transport") return "transport";
  if (firstType === "shelter") return "shelter";
  if (firstType === "medical") return "medical";
  if (firstType === "funds") return "funds";
  if (firstType === "rescue" || firstType === "information") return "volunteer";
  return "supplies";
}

export function ReportModal({
  t,
  language,
  report,
  user,
  hazards,
  onClose,
  onEdit,
  onRequireAuth,
  onConnectionCreated,
  onChanged
}: ReportModalProps) {
  const [mode, setMode] = useState<"details" | "offer" | "flag">("details");
  const [offerType, setOfferType] = useState<OfferType>("supplies");
  const [message, setMessage] = useState("");
  const [flagReason, setFlagReason] = useState("incorrect");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentMessage, setCommentMessage] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const city = CITIES.find((item) => item.id === report.city);
  const cityName = language === "es" ? city?.name : city?.nameEn;
  const mmi = sampleModeledMmi(
    hazards?.shakemap.modeledCells,
    report.latitude,
    report.longitude
  );
  const reportCell = latLngToCell(report.latitude, report.longitude, 9);
  const officialFindings = hazards?.copernicus.areas
    .filter((area) => area.city === report.city)
    .flatMap((area) => area.damagePoints)
    .filter(
      (point) => latLngToCell(point.latitude, point.longitude, 9) === reportCell
    ).length ?? 0;
  const isAuthor = user?.id === report.userId;
  const canModerate = user?.role === "moderator";
  const canDelete = Boolean(isAuthor || canModerate);

  useEffect(() => {
    let active = true;
    setComments([]);
    setCommentsLoading(true);
    setCommentError("");
    api
      .reportComments(report.id)
      .then(({ comments: nextComments }) => {
        if (active) setComments(nextComments);
      })
      .catch(() => {
        if (active) setCommentError(t("commentsLoadError"));
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [report.id, t, user?.id]);

  const confirm = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.confirmReport(report.id);
      onChanged(t("confirmed"));
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const changeStatus = async (status: ReportStatus) => {
    setSubmitting(true);
    setError("");
    try {
      await api.updateReport(report.id, status);
      onChanged(
        report.postType !== "need"
          ? status === "resolved"
            ? t("statusClosed")
            : report.postType === "offer"
              ? t("statusAvailable")
              : t("statusPublished")
          : status === "resolved"
            ? t("statusResolved")
            : t("statusOpen")
      );
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteReport = async () => {
    setSubmitting(true);
    setError("");
    try {
      await api.deleteReport(report.id);
      onChanged(t("postDeleted"));
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const sendOffer = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const result = await api.sendOffer(
        report.id,
        connectionType(report, offerType),
        message
      );
      onConnectionCreated(
        result.id,
        report.postType === "need" ? t("offerSent") : t("messageSent")
      );
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const flag = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.flagReport(report.id, flagReason);
      onChanged(t("flagSent"));
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const publishComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    const nextMessage = commentMessage.trim();
    if (!nextMessage) return;
    setCommentSubmitting(true);
    setCommentError("");
    try {
      const { comment } = await api.createReportComment(report.id, nextMessage);
      setComments((current) => [...current, comment]);
      setCommentMessage("");
    } catch (caught) {
      setCommentError(
        caught instanceof ApiRequestError ? caught.message : t("genericError")
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        report.postType === "need"
          ? t("reportDetails")
          : report.postType === "offer"
            ? t("availableHelpDetails")
            : t("communityUpdateDetails")
      }
      t={t}
      onClose={onClose}
      size="medium"
    >
      {mode === "details" ? (
        <>
          <div className="report-detail__heading">
            {report.postType === "need" ? (
              <span className={`urgency-badge urgency-${report.urgency}`}>
                <CircleAlert size={16} aria-hidden="true" />
                {t("urgencyLevel", { count: report.urgency })}
              </span>
            ) : (
              <span
                className={
                  report.postType === "offer" ? "offer-kind-badge" : "update-kind-badge"
                }
              >
                {report.postType === "offer" ? (
                  <HeartHandshake size={16} aria-hidden="true" />
                ) : (
                  <MessageCircle size={16} aria-hidden="true" />
                )}
                {report.postType === "offer" ? t("offerPost") : t("updatePost")}
              </span>
            )}
            <span className={`status-pill status-pill--${report.status}`}>
              {report.postType === "offer"
                ? report.status === "open"
                  ? t("statusAvailable")
                  : report.status === "matched"
                    ? t("statusCoordinating")
                    : t("statusClosed")
                : report.postType === "update"
                  ? report.status === "open"
                    ? t("statusPublished")
                    : report.status === "matched"
                      ? t("statusCoordinating")
                      : t("statusClosed")
                  : report.status === "open"
                    ? t("statusOpen")
                    : report.status === "matched"
                      ? t("statusMatched")
                      : t("statusResolved")}
            </span>
          </div>
          <h3 className="report-detail__location">
            {report.locationMode === "remote" ? (
              <Globe2 size={20} aria-hidden="true" />
            ) : (
              <MapPin size={20} aria-hidden="true" />
            )}
            <span>
              {report.locationMode === "remote"
                ? t("remoteHelp")
                : report.neighborhood || cityName}
              <small>
                {report.locationMode === "remote"
                  ? t("supportingCommunity", { city: cityName ?? "" })
                  : `${cityName} · ${t("approximateLocation")}`}
              </small>
            </span>
          </h3>
          <p className="report-detail__text">{report.details}</p>
          <div className="report-detail__needs">
            {report.needTypes.map((type) => (
              <span key={type}>
                <NeedIcon type={type} size={16} />
                {t(
                  {
                    water: "needWater",
                    food: "needFood",
                    shelter: "needShelter",
                    medical: "needMedical",
                    hygiene: "needHygiene",
                    rescue: "needRescue",
                    transport: "needTransport",
                    information: "needInformation",
                    funds: "needFunds"
                  }[type] as Parameters<TFunction>[0]
                )}
              </span>
            ))}
          </div>
          <div className="report-detail__facts">
            {report.postType === "update" ? (
              <div>
                <MessageCircle size={18} aria-hidden="true" />
                <span>
                  <strong>{t("updatePost")}</strong>
                  <small>{t("reportedBy", { name: report.author.displayName })}</small>
                </span>
                {report.author.verified ? (
                  <BadgeCheck size={17} aria-label={t("verifiedRepresentative")} />
                ) : null}
              </div>
            ) : (
              <div>
                <UsersRound size={18} aria-hidden="true" />
                <span>
                  <strong>
                    {report.peopleCount === 1
                      ? t("onePerson")
                      : t("people", { count: report.peopleCount })}
                  </strong>
                  <small>{t("reportedBy", { name: report.author.displayName })}</small>
                </span>
                {report.author.verified ? (
                  <BadgeCheck size={17} aria-label={t("verifiedRepresentative")} />
                ) : null}
              </div>
            )}
            {report.postType === "need" ? (
              <div>
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>
                  <strong>
                    {report.confirmations === 1
                      ? t("oneConfirmation")
                      : t("confirmations", { count: report.confirmations })}
                  </strong>
                  <small>{formatRelativeTime(report.updatedAt, language, t)}</small>
                </span>
              </div>
            ) : null}
          </div>
          {report.postType === "need" ? (
            <>
              <div className="evidence-grid">
                <div>
                  <span>{t("officialIntensity")}</span>
                  <strong>{mmi == null ? "-" : `MMI ${mmi}`}</strong>
                  <small>{t("modeledNotDamage")}</small>
                </div>
                <div>
                  <span>{t("officialMappedDamage")}</span>
                  <strong>{officialFindings}</strong>
                  <small>{t("findingsInPublicCell")}</small>
                </div>
              </div>
              <p className="evidence-disclaimer">{t("reportEvidenceDisclaimer")}</p>
            </>
          ) : (
            <div className="offer-form-context offer-form-context--detail">
              {report.postType === "offer" ? (
                <HeartHandshake size={21} aria-hidden="true" />
              ) : (
                <MessageCircle size={21} aria-hidden="true" />
              )}
              <span>{t("offerExcludedFromRisk")}</span>
            </div>
          )}
          {report.postType === "update" ? (
            <div className="safety-callout fundraiser-callout">
              <ShieldAlert size={18} aria-hidden="true" />
              <span>{t("fundraiserSafety")}</span>
            </div>
          ) : null}
          <section className="report-comments" aria-labelledby="report-comments-title">
            <header>
              <span>
                <MessageCircle size={17} aria-hidden="true" />
                <strong id="report-comments-title">{t("discussion")}</strong>
              </span>
              <small>{t("discussionCount", { count: comments.length })}</small>
            </header>
            {commentsLoading ? (
              <p className="report-comments__state" role="status">
                {t("commentsLoading")}
              </p>
            ) : comments.length ? (
              <ol className="report-comments__list">
                {comments.map((comment) => (
                  <li key={comment.id} className={comment.mine ? "is-mine" : ""}>
                    <div>
                      <strong>{comment.authorName}</strong>
                      {comment.authorVerified ? (
                        <BadgeCheck
                          size={14}
                          aria-label={t("verifiedRepresentative")}
                        />
                      ) : null}
                      <time dateTime={comment.createdAt}>
                        {formatRelativeTime(comment.createdAt, language, t)}
                      </time>
                    </div>
                    <p>{comment.message}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="report-comments__state">{t("noComments")}</p>
            )}
            {report.status === "resolved" ? (
              <p className="report-comments__closed">
                <CheckCircle2 size={15} aria-hidden="true" />
                {t("commentsClosed")}
              </p>
            ) : user ? (
              <form className="report-comments__form" onSubmit={publishComment}>
                <label>
                  <span className="sr-only">{t("commentPlaceholder")}</span>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={commentMessage}
                    placeholder={t("commentPlaceholder")}
                    onChange={(event) => setCommentMessage(event.target.value)}
                    required
                  />
                </label>
                <div>
                  <small>{t("publicCommentNote")}</small>
                  <button
                    className="button button--secondary"
                    type="submit"
                    disabled={commentSubmitting || !commentMessage.trim()}
                  >
                    {commentSubmitting ? t("publishingComment") : t("publishComment")}
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="report-comments__signin"
                type="button"
                onClick={onRequireAuth}
              >
                {t("signInToComment")}
              </button>
            )}
            {commentError ? (
              <div className="form-error" role="alert">{commentError}</div>
            ) : null}
          </section>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="report-detail__actions">
            {canModerate ? (
              report.status === "resolved" ? (
                <button className="button button--secondary" type="button" disabled={submitting} onClick={() => changeStatus("open")}>
                  {report.postType === "need" ? t("reopen") : t("reopenPost")}
                </button>
              ) : (
                <button className="button button--primary" type="button" disabled={submitting} onClick={() => changeStatus("resolved")}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  {report.postType === "need" ? t("markResolved") : t("closePost")}
                </button>
              )
            ) : null}
            {isAuthor ? (
              <button
                className="button button--secondary"
                type="button"
                disabled={submitting}
                onClick={onEdit}
              >
                <Pencil size={17} aria-hidden="true" />
                {t("editPost")}
              </button>
            ) : null}
            {canDelete ? (
              <button
                className="button button--danger"
                type="button"
                disabled={submitting}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 size={17} aria-hidden="true" />
                {t("deletePost")}
              </button>
            ) : null}
            {!isAuthor ? (
              <>
                {report.postType === "need" && !canModerate ? (
                  <button className="button button--secondary" type="button" disabled={submitting} onClick={confirm}>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    {t("confirm")}
                  </button>
                ) : null}
                {report.status !== "resolved" ? (
                  <button
                    className="button button--give"
                    type="button"
                    onClick={() => (user ? setMode("offer") : onRequireAuth())}
                  >
                    <Handshake size={18} aria-hidden="true" />
                    {report.postType === "need"
                      ? t("sendOffer")
                      : report.postType === "offer"
                        ? t("contactAvailableHelp")
                        : t("replyPrivately")}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
          {canDelete && confirmingDelete ? (
            <div className="delete-confirmation" role="alert">
              <div>
                <strong>{t("deletePostConfirmTitle")}</strong>
                <p>{t("deletePostWarning")}</p>
              </div>
              <div>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmingDelete(false)}
                >
                  {t("cancel")}
                </button>
                <button
                  className="button button--danger"
                  type="button"
                  disabled={submitting}
                  onClick={() => void deleteReport()}
                >
                  <Trash2 size={17} aria-hidden="true" />
                  {t("deletePermanently")}
                </button>
              </div>
            </div>
          ) : null}
          {!isAuthor && !canModerate ? (
            <button
              className="flag-button"
              type="button"
              onClick={() => (user ? setMode("flag") : onRequireAuth())}
            >
              <Flag size={15} aria-hidden="true" />
              {t("reportFlag")}
            </button>
          ) : null}
        </>
      ) : null}

      {mode === "offer" ? (
        <form className="form-stack" onSubmit={sendOffer}>
          <div className="offer-recipient">
            <MessageCircle size={20} aria-hidden="true" />
            <span>
              <small>
                {report.postType === "need"
                  ? t("offerTitle")
                  : report.postType === "offer"
                    ? t("contactAvailableHelp")
                    : t("replyPrivately")}
              </small>
              <strong>
                {report.postType === "need"
                  ? t("offerTo", { name: report.author.displayName })
                  : t("contactTo", { name: report.author.displayName })}
              </strong>
            </span>
          </div>
          {report.postType === "need" ? (
            <fieldset className="field">
              <legend>{t("offerType")}</legend>
              <div className="choice-grid choice-grid--compact">
                {OFFER_TYPES.map((type) => (
                  <label key={type} className={offerType === type ? "choice is-selected" : "choice"}>
                    <input
                      type="radio"
                      name="offerType"
                      value={type}
                      checked={offerType === type}
                      onChange={() => setOfferType(type)}
                    />
                    <OfferIcon type={type} size={17} />
                    <span>{offerLabel(type, t)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label className="field">
            <span>{t("privateMessage")}</span>
            <textarea
              rows={5}
              minLength={10}
              maxLength={500}
              value={message}
              aria-label={t("privateMessage")}
              placeholder={
                report.postType === "need"
                  ? t("privateMessagePlaceholder")
                  : report.postType === "offer"
                    ? t("contactMessagePlaceholder")
                    : t("replyMessagePlaceholder")
              }
              onChange={(event) => setMessage(event.target.value)}
              required
            />
            <small className="char-count">{t("charCount", { count: message.length, max: 500 })}</small>
          </label>
          <div className="safety-callout">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>{t("coordinationSafety")}</span>
          </div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="form-actions">
            <button className="button button--secondary" type="button" onClick={() => setMode("details")}>
              {t("cancel")}
            </button>
            <button className="button button--give" type="submit" disabled={submitting || message.trim().length < 10}>
              {submitting
                ? t("sending")
                : report.postType === "need"
                  ? t("sendPrivateOffer")
                  : t("sendPrivateMessage")}
            </button>
          </div>
        </form>
      ) : null}

      {mode === "flag" ? (
        <form className="form-stack" onSubmit={flag}>
          <div className="privacy-note">
            <Flag size={19} aria-hidden="true" />
            <strong>{t("reportReason")}</strong>
          </div>
          <label className="field">
            <span>{t("reportReason")}</span>
            <select value={flagReason} onChange={(event) => setFlagReason(event.target.value)}>
              <option value="incorrect">{t("reasonIncorrect")}</option>
              <option value="duplicate">{t("reasonDuplicate")}</option>
              <option value="unsafe">{t("reasonUnsafe")}</option>
              <option value="fraud">{t("reasonFraud")}</option>
              <option value="other">{t("reasonOther")}</option>
            </select>
          </label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="form-actions">
            <button className="button button--secondary" type="button" onClick={() => setMode("details")}>
              {t("cancel")}
            </button>
            <button className="button button--danger" type="submit" disabled={submitting}>
              {t("reportFlag")}
            </button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
