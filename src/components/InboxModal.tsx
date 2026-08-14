import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock3,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../api";
import { CITIES } from "../data";
import { formatRelativeTime } from "../format";
import type { TFunction } from "../i18n";
import type { ChatMessage, Language, Offer, OfferStatus, OfferType } from "../types";
import { Modal } from "./Modal";
import { OfferIcon } from "./NeedIcon";

interface InboxModalProps {
  t: TFunction;
  language: Language;
  offers: Offer[];
  onClose: () => void;
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

function statusLabel(status: OfferStatus, t: TFunction): string {
  return t(
    {
      pending: "pending",
      accepted: "accepted",
      declined: "declined",
      withdrawn: "withdrawn"
    }[status] as Parameters<TFunction>[0]
  );
}

export function InboxModal({
  t,
  language,
  offers,
  onClose,
  onChanged
}: InboxModalProps) {
  const [direction, setDirection] = useState<"received" | "sent">("received");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chatOfferId, setChatOfferId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [chatBusy, setChatBusy] = useState(false);
  const lastMessageIds = useRef<Record<string, number>>({});
  const [error, setError] = useState("");
  const visibleOffers = useMemo(
    () => offers.filter((offer) => offer.direction === direction),
    [direction, offers]
  );

  const loadChat = useCallback(
    async (offerId: string, quiet = false) => {
      try {
        const after = lastMessageIds.current[offerId] ?? 0;
        const result = await api.chatMessages(offerId, after);
        if (!result.messages.length) return;
        setChatMessages((current) => {
          const existing = current[offerId] ?? [];
          const ids = new Set(existing.map((message) => message.id));
          return {
            ...current,
            [offerId]: [
              ...existing,
              ...result.messages.filter((message) => !ids.has(message.id))
            ]
          };
        });
        lastMessageIds.current[offerId] = Math.max(
          after,
          ...result.messages.map((message) => message.id)
        );
      } catch (caught) {
        if (!quiet) {
          setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
        }
      }
    },
    [t]
  );

  useEffect(() => {
    if (!chatOfferId) return;
    void loadChat(chatOfferId);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadChat(chatOfferId, true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [chatOfferId, loadChat]);

  const sendMessage = async (event: FormEvent, offerId: string) => {
    event.preventDefault();
    const draft = (chatDrafts[offerId] ?? "").trim();
    if (!draft) return;
    setChatBusy(true);
    setError("");
    try {
      const result = await api.sendChatMessage(offerId, draft);
      setChatMessages((current) => ({
        ...current,
        [offerId]: [...(current[offerId] ?? []), result.message]
      }));
      lastMessageIds.current[offerId] = result.message.id;
      setChatDrafts((current) => ({ ...current, [offerId]: "" }));
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      setChatBusy(false);
    }
  };

  const update = async (
    offer: Offer,
    status: Extract<OfferStatus, "accepted" | "declined" | "withdrawn">
  ) => {
    setBusyId(offer.id);
    setError("");
    try {
      await api.updateOffer(offer.id, status, responses[offer.id] ?? "");
      onChanged(statusLabel(status, t));
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal title={t("inboxTitle")} t={t} onClose={onClose} size="large">
      <div className="segmented-control">
        <button
          type="button"
          className={direction === "received" ? "is-active" : ""}
          onClick={() => setDirection("received")}
        >
          <ArrowDownLeft size={17} aria-hidden="true" />
          {t("received")}
          <span>{offers.filter((offer) => offer.direction === "received").length}</span>
        </button>
        <button
          type="button"
          className={direction === "sent" ? "is-active" : ""}
          onClick={() => setDirection("sent")}
        >
          <ArrowUpRight size={17} aria-hidden="true" />
          {t("sent")}
          <span>{offers.filter((offer) => offer.direction === "sent").length}</span>
        </button>
      </div>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="inbox-list">
        {visibleOffers.length ? (
          visibleOffers.map((offer) => {
            const city = CITIES.find((item) => item.id === offer.report.city);
            const isPending = offer.status === "pending";
            return (
              <article key={offer.id} className="offer-entry">
                <header>
                  <span className="offer-entry__icon">
                    <OfferIcon type={offer.offerType} size={18} />
                  </span>
                  <span>
                    <strong>
                      {offer.report.postType === "offer"
                        ? t("contactAvailableHelp")
                        : offer.report.postType === "update"
                          ? t("replyPrivately")
                          : offerLabel(offer.offerType, t)}
                    </strong>
                    <small>
                      {direction === "received" ? offer.senderName : offer.recipientName}
                      {" · "}
                      {formatRelativeTime(offer.createdAt, language, t)}
                    </small>
                  </span>
                  <span className={`status-pill status-pill--${offer.status}`}>
                    {offer.status === "pending" ? <Clock3 size={13} aria-hidden="true" /> : null}
                    {statusLabel(offer.status, t)}
                  </span>
                </header>
                <div className="offer-entry__context">
                  <strong>{offer.report.neighborhood || city?.name}</strong>
                  <span>{offer.report.details}</span>
                </div>
                <blockquote>{offer.message}</blockquote>
                {offer.responseMessage ? (
                  <div className="private-response">
                    <Mail size={17} aria-hidden="true" />
                    <span>
                      <strong>{t("privateReply")}</strong>
                      <p>{offer.responseMessage}</p>
                    </span>
                  </div>
                ) : null}
                {direction === "received" && isPending ? (
                  <>
                    <label className="field">
                      <span>{t("privateReply")}</span>
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={responses[offer.id] ?? ""}
                        placeholder={t("responsePlaceholder")}
                        onChange={(event) =>
                          setResponses((current) => ({
                            ...current,
                            [offer.id]: event.target.value
                          }))
                        }
                      />
                    </label>
                    <div className="offer-entry__actions">
                      <button
                        className="button button--secondary"
                        type="button"
                        disabled={busyId === offer.id}
                        onClick={() => update(offer, "declined")}
                      >
                        <X size={17} aria-hidden="true" />
                        {t("decline")}
                      </button>
                      <button
                        className="button button--give"
                        type="button"
                        disabled={busyId === offer.id}
                        onClick={() => update(offer, "accepted")}
                      >
                        <Check size={17} aria-hidden="true" />
                        {t("acceptResponse")}
                      </button>
                    </div>
                  </>
                ) : null}
                {direction === "sent" && isPending ? (
                  <button
                    className="text-button text-button--danger"
                    type="button"
                    disabled={busyId === offer.id}
                    onClick={() => update(offer, "withdrawn")}
                  >
                    {t("withdraw")}
                  </button>
                ) : null}
                {offer.status === "accepted" ? (
                  <>
                    <button
                      className="chat-toggle"
                      type="button"
                      onClick={() =>
                        setChatOfferId((current) => (current === offer.id ? null : offer.id))
                      }
                      aria-expanded={chatOfferId === offer.id}
                    >
                      <MessageCircle size={17} aria-hidden="true" />
                      {chatOfferId === offer.id ? t("closeChat") : t("openChat")}
                    </button>
                    {chatOfferId === offer.id ? (
                      <section className="chat-thread" aria-label={t("privateChat")}>
                        <header>
                          <strong>{t("privateChat")}</strong>
                          <button
                            className="icon-button icon-button--small"
                            type="button"
                            onClick={() => void loadChat(offer.id)}
                            aria-label={t("refreshChat")}
                            title={t("refreshChat")}
                          >
                            <RefreshCw size={15} aria-hidden="true" />
                          </button>
                        </header>
                        <div className="chat-messages" role="log" aria-live="polite">
                          {(chatMessages[offer.id] ?? []).length ? (
                            (chatMessages[offer.id] ?? []).map((chatMessage) => (
                              <div
                                key={chatMessage.id}
                                className={`chat-message${chatMessage.mine ? " chat-message--mine" : ""}`}
                              >
                                <span>{chatMessage.message}</span>
                                <small>
                                  {chatMessage.senderName} ·{" "}
                                  {formatRelativeTime(chatMessage.createdAt, language, t)}
                                </small>
                              </div>
                            ))
                          ) : (
                            <p className="chat-empty">{t("noChatMessages")}</p>
                          )}
                        </div>
                        <form
                          className="chat-composer"
                          onSubmit={(event) => void sendMessage(event, offer.id)}
                        >
                          <input
                            type="text"
                            maxLength={500}
                            value={chatDrafts[offer.id] ?? ""}
                            placeholder={t("chatMessagePlaceholder")}
                            aria-label={t("chatMessagePlaceholder")}
                            onChange={(event) =>
                              setChatDrafts((current) => ({
                                ...current,
                                [offer.id]: event.target.value
                              }))
                            }
                          />
                          <button
                            type="submit"
                            disabled={chatBusy || !(chatDrafts[offer.id] ?? "").trim()}
                            aria-label={t("sendMessage")}
                            title={t("sendMessage")}
                          >
                            <Send size={17} aria-hidden="true" />
                          </button>
                        </form>
                      </section>
                    ) : null}
                  </>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="empty-state">
            <Mail size={28} aria-hidden="true" />
            <strong>{t("noMessages")}</strong>
          </div>
        )}
      </div>
      <div className="safety-callout">
        <ShieldAlert size={18} aria-hidden="true" />
        <span>{t("coordinationSafety")}</span>
      </div>
    </Modal>
  );
}
