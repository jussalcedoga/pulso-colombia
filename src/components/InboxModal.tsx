import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  UserRound,
  X
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import { api, ApiRequestError } from "../api";
import { CITIES } from "../data";
import { formatRelativeTime } from "../format";
import type { TFunction } from "../i18n";
import type {
  ChatMessage,
  Language,
  Offer,
  OfferStatus,
  OfferType,
  User
} from "../types";
import { Modal } from "./Modal";
import { OfferIcon } from "./NeedIcon";

interface InboxModalProps {
  t: TFunction;
  language: Language;
  user: User;
  offers: Offer[];
  loading: boolean;
  loadError: string;
  initialOfferId: string | null;
  onRefresh: () => void;
  onRead: (offerId: string) => void;
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

function statusLabel(offer: Offer, t: TFunction): string {
  if (offer.report.postType !== "need" && offer.canChat) return t("privateChat");
  return t(
    {
      pending: "pending",
      accepted: "accepted",
      declined: "declined",
      withdrawn: "withdrawn"
    }[offer.status] as Parameters<TFunction>[0]
  );
}

function conversationLabel(offer: Offer, t: TFunction): string {
  if (offer.report.postType === "offer") return t("contactAvailableHelp");
  if (offer.report.postType === "update") return t("replyPrivately");
  return offerLabel(offer.offerType, t);
}

function counterpartName(offer: Offer): string {
  return offer.direction === "received" ? offer.senderName : offer.recipientName;
}

export function InboxModal({
  t,
  language,
  user,
  offers,
  loading,
  loadError,
  initialOfferId,
  onRefresh,
  onRead,
  onClose,
  onChanged
}: InboxModalProps) {
  const [direction, setDirection] = useState<"received" | "sent">("received");
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>(
    {}
  );
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [chatBusyId, setChatBusyId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");
  const lastMessageIds = useRef<Record<string, number>>({});
  const handledInitialOfferId = useRef<string | null>(null);
  const messageListRef = useRef<HTMLDivElement | null>(null);

  const visibleOffers = useMemo(
    () => offers.filter((offer) => offer.direction === direction),
    [direction, offers]
  );
  const selectedOffer =
    offers.find((offer) => offer.id === selectedOfferId) ?? null;
  const selectedMessages = selectedOfferId
    ? (chatMessages[selectedOfferId] ?? [])
    : [];

  const markRead = useCallback(
    (offer: Offer) => {
      if (offer.unreadCount > 0) onRead(offer.id);
    },
    [onRead]
  );

  const loadChat = useCallback(
    async (offerId: string, quiet = false) => {
      if (!quiet) setChatLoading(true);
      try {
        const after = lastMessageIds.current[offerId] ?? 0;
        const result = await api.chatMessages(offerId, after);
        if (result.messages.length) {
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
          if (result.messages.some((message) => !message.mine)) onRead(offerId);
        }
      } catch (caught) {
        if (!quiet) {
          setError(
            caught instanceof ApiRequestError ? caught.message : t("genericError")
          );
        }
      } finally {
        if (!quiet) setChatLoading(false);
      }
    },
    [onRead, t]
  );

  useEffect(() => {
    if (!initialOfferId) return;
    if (handledInitialOfferId.current === initialOfferId) return;
    const offer = offers.find((item) => item.id === initialOfferId);
    if (!offer) return;
    handledInitialOfferId.current = initialOfferId;
    setDirection(offer.direction);
    setSelectedOfferId(offer.id);
    markRead(offer);
  }, [initialOfferId, markRead, offers]);

  useEffect(() => {
    if (selectedOfferId && !offers.some((offer) => offer.id === selectedOfferId)) {
      setSelectedOfferId(null);
    }
  }, [offers, selectedOfferId]);

  useEffect(() => {
    if (!selectedOffer?.canChat) return;
    void loadChat(selectedOffer.id);
    const refreshVisibleChat = () => {
      if (document.visibilityState === "visible") {
        void loadChat(selectedOffer.id, true);
      }
    };
    const timer = window.setInterval(refreshVisibleChat, 20_000);
    document.addEventListener("visibilitychange", refreshVisibleChat);
    window.addEventListener("focus", refreshVisibleChat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisibleChat);
      window.removeEventListener("focus", refreshVisibleChat);
    };
  }, [loadChat, selectedOffer?.canChat, selectedOffer?.id]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [selectedMessages.length, selectedOfferId]);

  const openConversation = (offer: Offer) => {
    setSelectedOfferId(offer.id);
    setError("");
    markRead(offer);
  };

  const changeDirection = (nextDirection: "received" | "sent") => {
    setDirection(nextDirection);
    setSelectedOfferId(null);
    setError("");
  };

  const sendMessage = async (event: FormEvent, offerId: string) => {
    event.preventDefault();
    const draft = (chatDrafts[offerId] ?? "").trim();
    if (!draft) return;
    setChatBusyId(offerId);
    setError("");
    try {
      const result = await api.sendChatMessage(offerId, draft);
      setChatMessages((current) => ({
        ...current,
        [offerId]: [...(current[offerId] ?? []), result.message]
      }));
      lastMessageIds.current[offerId] = Math.max(
        lastMessageIds.current[offerId] ?? 0,
        result.message.id
      );
      setChatDrafts((current) => ({ ...current, [offerId]: "" }));
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : t("genericError")
      );
    } finally {
      setChatBusyId(null);
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
      setResponses((current) => ({ ...current, [offer.id]: "" }));
      onChanged(
        t(
          {
            accepted: "accepted",
            declined: "declined",
            withdrawn: "withdrawn"
          }[status] as Parameters<TFunction>[0]
        )
      );
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : t("genericError")
      );
    } finally {
      setBusyId(null);
    }
  };

  const receivedCount = offers.filter(
    (offer) => offer.direction === "received"
  ).length;
  const sentCount = offers.length - receivedCount;

  return (
    <Modal title={t("inboxTitle")} t={t} onClose={onClose} size="large">
      <div className="inbox-account">
        <UserRound size={20} aria-hidden="true" />
        <span>
          <strong>{t("inboxSignedInAs", { name: user.displayName })}</strong>
          <small>
            {t("inboxAccountHint", {
              id: user.id.slice(-6).toUpperCase()
            })}
          </small>
        </span>
        <button
          className="button button--secondary inbox-refresh"
          type="button"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw
            className={loading ? "spin-icon" : undefined}
            size={16}
            aria-hidden="true"
          />
          {loading ? t("refreshingInbox") : t("refreshInbox")}
        </button>
      </div>
      <p className="inbox-device-note">{t("inboxDeviceHint")}</p>

      <div className="segmented-control inbox-direction">
        <button
          type="button"
          className={direction === "received" ? "is-active" : ""}
          onClick={() => changeDirection("received")}
        >
          <ArrowDownLeft size={17} aria-hidden="true" />
          {t("received")}
          <span>{receivedCount}</span>
        </button>
        <button
          type="button"
          className={direction === "sent" ? "is-active" : ""}
          onClick={() => changeDirection("sent")}
        >
          <ArrowUpRight size={17} aria-hidden="true" />
          {t("sent")}
          <span>{sentCount}</span>
        </button>
      </div>

      {loadError ? <div className="form-error" role="alert">{loadError}</div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <div
        className={`inbox-layout${selectedOffer ? " has-selection" : ""}`}
      >
        <section className="conversation-list-pane" aria-label={t("inboxTitle")}>
          {visibleOffers.length ? (
            <div className="conversation-list">
              {visibleOffers.map((offer) => {
                const name = counterpartName(offer);
                const isSelected = selectedOfferId === offer.id;
                return (
                  <button
                    key={offer.id}
                    className={`conversation-row${isSelected ? " is-selected" : ""}${
                      offer.unreadCount ? " has-unread" : ""
                    }`}
                    type="button"
                    onClick={() => openConversation(offer)}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <span className="conversation-row__icon">
                      <OfferIcon type={offer.offerType} size={17} />
                    </span>
                    <span className="conversation-row__body">
                      <span className="conversation-row__topline">
                        <strong>{name}</strong>
                        <time dateTime={offer.updatedAt}>
                          {formatRelativeTime(offer.updatedAt, language, t)}
                        </time>
                      </span>
                      <span className="conversation-row__kind">
                        {conversationLabel(offer, t)}
                      </span>
                      <span className="conversation-row__preview">{offer.message}</span>
                    </span>
                    <span className="conversation-row__meta">
                      <small className={`status-pill status-pill--${offer.status}`}>
                        {statusLabel(offer, t)}
                      </small>
                      {offer.unreadCount > 0 ? (
                        <span
                          className="conversation-unread"
                          aria-label={t("messagesCount", {
                            count: offer.unreadCount
                          })}
                        >
                          {Math.min(99, offer.unreadCount)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="conversation-empty">
              <Mail size={25} aria-hidden="true" />
              <strong>{t("noMessages")}</strong>
            </div>
          )}
        </section>

        <section className="conversation-pane" aria-label={t("privateChat")}>
          {selectedOffer ? (
            <>
              <header className="conversation-header">
                <button
                  className="icon-button conversation-back"
                  type="button"
                  onClick={() => setSelectedOfferId(null)}
                  aria-label={t("backToMessages")}
                  title={t("backToMessages")}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
                <span>
                  <small>{conversationLabel(selectedOffer, t)}</small>
                  <strong>{counterpartName(selectedOffer)}</strong>
                </span>
                <span
                  className={`status-pill status-pill--${selectedOffer.status}`}
                >
                  {selectedOffer.status === "pending" ? (
                    <Clock3 size={13} aria-hidden="true" />
                  ) : null}
                  {statusLabel(selectedOffer, t)}
                </span>
                {selectedOffer.canChat ? (
                  <button
                    className="icon-button icon-button--small"
                    type="button"
                    onClick={() => void loadChat(selectedOffer.id)}
                    aria-label={t("refreshChat")}
                    title={t("refreshChat")}
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </header>

              <div className="conversation-context">
                <strong>
                  {selectedOffer.report.neighborhood ||
                    (language === "es"
                      ? CITIES.find(
                          (city) => city.id === selectedOffer.report.city
                        )?.name
                      : CITIES.find(
                          (city) => city.id === selectedOffer.report.city
                        )?.nameEn)}
                </strong>
                <span>{selectedOffer.report.details}</span>
              </div>

              <div
                className="chat-messages"
                ref={messageListRef}
                role="log"
                aria-live="polite"
              >
                <div
                  className={`chat-message${
                    selectedOffer.senderId === user.id
                      ? " chat-message--mine"
                      : ""
                  }`}
                >
                  <span>{selectedOffer.message}</span>
                  <small>
                    {selectedOffer.senderName} ·{" "}
                    {formatRelativeTime(selectedOffer.createdAt, language, t)}
                  </small>
                </div>
                {selectedOffer.responseMessage ? (
                  <div
                    className={`chat-message${
                      selectedOffer.recipientId === user.id
                        ? " chat-message--mine"
                        : ""
                    }`}
                  >
                    <span>{selectedOffer.responseMessage}</span>
                    <small>
                      {selectedOffer.recipientName} ·{" "}
                      {formatRelativeTime(selectedOffer.updatedAt, language, t)}
                    </small>
                  </div>
                ) : null}
                {selectedMessages.map((chatMessage) => (
                  <div
                    key={chatMessage.id}
                    className={`chat-message${
                      chatMessage.mine ? " chat-message--mine" : ""
                    }`}
                  >
                    <span>{chatMessage.message}</span>
                    <small>
                      {chatMessage.senderName} ·{" "}
                      {formatRelativeTime(chatMessage.createdAt, language, t)}
                    </small>
                  </div>
                ))}
                {chatLoading && !selectedMessages.length ? (
                  <p className="chat-loading" role="status">{t("loading")}</p>
                ) : null}
              </div>

              {selectedOffer.direction === "received" &&
              selectedOffer.status === "pending" &&
              selectedOffer.report.postType === "need" ? (
                <div className="conversation-decision">
                  <label className="field">
                    <span>{t("privateReply")}</span>
                    <textarea
                      rows={2}
                      maxLength={500}
                      value={responses[selectedOffer.id] ?? ""}
                      placeholder={t("responsePlaceholder")}
                      onChange={(event) =>
                        setResponses((current) => ({
                          ...current,
                          [selectedOffer.id]: event.target.value
                        }))
                      }
                    />
                  </label>
                  <div className="offer-entry__actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={busyId === selectedOffer.id}
                      onClick={() => update(selectedOffer, "declined")}
                    >
                      <X size={17} aria-hidden="true" />
                      {t("decline")}
                    </button>
                    <button
                      className="button button--give"
                      type="button"
                      disabled={busyId === selectedOffer.id}
                      onClick={() => update(selectedOffer, "accepted")}
                    >
                      <Check size={17} aria-hidden="true" />
                      {t("acceptResponse")}
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedOffer.direction === "sent" &&
              selectedOffer.status === "pending" &&
              selectedOffer.report.postType === "need" ? (
                <div className="conversation-waiting">
                  <Clock3 size={17} aria-hidden="true" />
                  <span>{t("waitingForResponse")}</span>
                  <button
                    className="text-button text-button--danger"
                    type="button"
                    disabled={busyId === selectedOffer.id}
                    onClick={() => update(selectedOffer, "withdrawn")}
                  >
                    {t("withdraw")}
                  </button>
                </div>
              ) : null}

              {selectedOffer.canChat ? (
                <form
                  className="chat-composer"
                  onSubmit={(event) =>
                    void sendMessage(event, selectedOffer.id)
                  }
                >
                  <textarea
                    rows={1}
                    maxLength={500}
                    value={chatDrafts[selectedOffer.id] ?? ""}
                    placeholder={t("chatMessagePlaceholder")}
                    aria-label={t("chatMessagePlaceholder")}
                    onChange={(event) =>
                      setChatDrafts((current) => ({
                        ...current,
                        [selectedOffer.id]: event.target.value
                      }))
                    }
                  />
                  <button
                    type="submit"
                    disabled={
                      chatBusyId === selectedOffer.id ||
                      !(chatDrafts[selectedOffer.id] ?? "").trim()
                    }
                    aria-label={t("sendMessage")}
                    title={t("sendMessage")}
                  >
                    <Send size={17} aria-hidden="true" />
                  </button>
                </form>
              ) : selectedOffer.status !== "pending" ? (
                <div className="conversation-closed">
                  <MessageCircle size={17} aria-hidden="true" />
                  {t("conversationClosed")}
                </div>
              ) : null}
            </>
          ) : (
            <div className="conversation-placeholder">
              <MessageCircle size={30} aria-hidden="true" />
              <strong>{t("selectConversation")}</strong>
              <span>{t("selectConversationHint")}</span>
            </div>
          )}
        </section>
      </div>

      <div className="safety-callout inbox-safety">
        <ShieldAlert size={18} aria-hidden="true" />
        <span>{t("coordinationSafety")}</span>
      </div>
    </Modal>
  );
}
