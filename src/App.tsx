import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiRequestError } from "./api";
import { createTranslator, detectLanguage } from "./i18n";
import { rankLocalAreas } from "./scoring";
import type {
  CityId,
  Language,
  NeedType,
  Offer,
  PostType,
  Report,
  User
} from "./types";
import { Header } from "./components/Header";
import { MapView, type MapLayers } from "./components/MapView";
import { SidePanel } from "./components/SidePanel";

const AuthModal = lazy(() =>
  import("./components/AuthModal").then((module) => ({ default: module.AuthModal }))
);
const AdminModal = lazy(() =>
  import("./components/AdminModal").then((module) => ({ default: module.AdminModal }))
);
const DonateModal = lazy(() =>
  import("./components/DonateModal").then((module) => ({ default: module.DonateModal }))
);
const InboxModal = lazy(() =>
  import("./components/InboxModal").then((module) => ({ default: module.InboxModal }))
);
const NeedModal = lazy(() =>
  import("./components/NeedModal").then((module) => ({ default: module.NeedModal }))
);
const RecoveryModal = lazy(() =>
  import("./components/RecoveryModal").then((module) => ({ default: module.RecoveryModal }))
);
const ReportModal = lazy(() =>
  import("./components/ReportModal").then((module) => ({ default: module.ReportModal }))
);
const SourcesModal = lazy(() =>
  import("./components/SourcesModal").then((module) => ({ default: module.SourcesModal }))
);

type ActiveModal = "auth" | "need" | "donate" | "inbox" | "sources" | "admin" | null;
type PanelTab = "needs" | "areas" | "resources";

export default function App() {
  const [language, setLanguage] = useState<Language>(() => detectLanguage());
  const t = useMemo(() => createTranslator(language), [language]);
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState("");
  const [selectedCity, setSelectedCity] = useState<CityId>("manizales");
  const [selectedNeed, setSelectedNeed] = useState<NeedType | "all">("all");
  const [selectedPostType, setSelectedPostType] = useState<PostType | "all">("all");
  const [tab, setTab] = useState<PanelTab>("needs");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [pendingPostAfterAuth, setPendingPostAfterAuth] = useState<PostType | null>(null);
  const [draftPostType, setDraftPostType] = useState<PostType>("need");
  const [focusedLocation, setFocusedLocation] = useState<[number, number] | null>(null);
  const [layers, setLayers] = useState<MapLayers>({
    base: "streets",
    reports: true
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState("");
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);

  const loadPublicData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const reportResult = await Promise.allSettled([api.reports()]);
    if (reportResult[0].status === "fulfilled") {
      setReports(reportResult[0].value.reports);
    }
    setLoadError(reportResult[0].status === "rejected");
    setLoading(false);
  }, []);

  const loadInbox = useCallback(async (showLoading = false) => {
    if (showLoading) setInboxLoading(true);
    setInboxError("");
    try {
      const result = await api.inbox();
      setOffers(result.offers);
      return true;
    } catch (caught) {
      setInboxError(
        caught instanceof ApiRequestError ? caught.message : t("inboxLoadError")
      );
      return false;
    } finally {
      if (showLoading) setInboxLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void Promise.all([
      loadPublicData(true),
      api.me().then((result) => setUser(result.user)).catch(() => setUser(null)),
      api.config()
        .then((result) => setTurnstileSiteKey(result.turnstileSiteKey))
        .catch(() => setTurnstileSiteKey(null))
    ]);
  }, [loadPublicData]);

  useEffect(() => {
    if (user) void loadInbox();
    else setOffers([]);
  }, [loadInbox, user]);

  useEffect(() => {
    const refreshVisibleData = () => {
      if (document.visibilityState !== "visible") return;
      void loadPublicData();
      if (user) void loadInbox();
    };
    const timer = window.setInterval(refreshVisibleData, 60_000);
    document.addEventListener("visibilitychange", refreshVisibleData);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisibleData);
    };
  }, [loadInbox, loadPublicData, user]);

  useEffect(() => {
    document.title = t("pageTitle");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("pageDescription"));
  }, [t]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleReports = useMemo(
    () => reports.filter((report) => report.city === selectedCity),
    [reports, selectedCity]
  );
  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? null;
  const localAreas = useMemo(
    () => rankLocalAreas(selectedCity, null, reports),
    [reports, selectedCity]
  );
  const inboxCount = offers.filter(
    (offer) => offer.direction === "received" && offer.status === "pending"
  ).length;
  const defaultCity: CityId = selectedCity ?? user?.city ?? "manizales";

  const changeLanguage = (next: Language) => {
    localStorage.setItem("pulso-language", next);
    document.documentElement.lang = next;
    setLanguage(next);
  };

  const openPost = (postType: PostType) => {
    setDraftPostType(postType);
    if (!user) {
      setPendingPostAfterAuth(postType);
      setActiveModal("auth");
      return;
    }
    setActiveModal("need");
  };

  const openNeed = () => openPost("need");
  const openAvailableHelp = () => openPost("offer");
  const openInbox = () => {
    setActiveModal("inbox");
    void loadInbox(true);
  };

  const handleAuthSuccess = (nextUser: User, code?: string) => {
    setUser(nextUser);
    if (code) {
      setRecoveryCode(code);
      setActiveModal(null);
      return;
    }
    if (pendingPostAfterAuth) setDraftPostType(pendingPostAfterAuth);
    setActiveModal(pendingPostAfterAuth ? "need" : null);
    setPendingPostAfterAuth(null);
  };

  const finishRecovery = () => {
    setRecoveryCode(null);
    if (pendingPostAfterAuth) setDraftPostType(pendingPostAfterAuth);
    setActiveModal(pendingPostAfterAuth ? "need" : null);
    setPendingPostAfterAuth(null);
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setOffers([]);
      setSelectedReportId(null);
      setToast(t("signOut"));
    }
  };

  const refreshAfterChange = async (message: string, closeReport = true) => {
    setToast(message);
    if (closeReport) setSelectedReportId(null);
    await Promise.all([loadPublicData(), user ? loadInbox() : Promise.resolve()]);
  };

  const changeCity = (city: CityId) => {
    setSelectedCity(city);
    setSelectedReportId(null);
    setFocusedLocation(null);
  };

  return (
    <div className="app">
      <Header
        t={t}
        language={language}
        user={user}
        hazards={null}
        inboxCount={inboxCount}
        onLanguageChange={changeLanguage}
        onAuth={() => setActiveModal("auth")}
        onLogout={() => void logout()}
        onInbox={openInbox}
        onAdmin={() => setActiveModal("admin")}
      />
      {!online ? (
        <div className="connection-banner connection-banner--offline" role="status">
          <CloudOff size={16} aria-hidden="true" />
          {t("offline")}
        </div>
      ) : null}
      {loadError ? (
        <div className="connection-banner connection-banner--error" role="alert">
          <CloudOff size={16} aria-hidden="true" />
          {t("loadFailure")}
          <button type="button" onClick={() => void loadPublicData(true)}>
            <RefreshCw size={15} aria-hidden="true" />
            {t("retry")}
          </button>
        </div>
      ) : null}

      <main className="workspace">
        <SidePanel
          t={t}
          language={language}
          selectedCity={selectedCity}
          selectedNeed={selectedNeed}
          selectedPostType={selectedPostType}
          tab={tab}
          reports={visibleReports}
          hazards={null}
          localAreas={localAreas}
          onCityChange={changeCity}
          onNeedChange={setSelectedNeed}
          onPostTypeChange={setSelectedPostType}
          onTabChange={setTab}
          onNeedHelp={openNeed}
          onOfferHelp={() => setActiveModal("donate")}
          onPostUpdate={() => openPost("update")}
          onReportSelect={(report) => setSelectedReportId(report.id)}
          onAreaFocus={(latitude, longitude) => {
            setSelectedReportId(null);
            setFocusedLocation([latitude, longitude]);
          }}
          onSources={() => setActiveModal("sources")}
        />
        <MapView
          t={t}
          selectedCity={selectedCity}
          reports={visibleReports}
          selectedReportId={selectedReportId}
          focusedLocation={focusedLocation}
          layers={layers}
          onCityChange={changeCity}
          onLayersChange={setLayers}
          onReportSelect={(report) => setSelectedReportId(report.id)}
          onLocationError={() => setToast(t("locationError"))}
          onNeedHelp={openNeed}
          onOfferHelp={() => setActiveModal("donate")}
        />
      </main>

      <footer className="mobile-footer">
        <span><Wifi size={14} aria-hidden="true" />{t("sourceOnline")}</span>
        <span>{t("footerDisclaimer")}</span>
      </footer>

      {loading ? (
        <div className="initial-loader" role="status">
          <span className="pulse-loader" aria-hidden="true" />
          <span>{t("loading")}</span>
        </div>
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}

      <Suspense fallback={null}>
        {activeModal === "auth" ? (
          <AuthModal
            t={t}
            language={language}
            initialCity={defaultCity}
            turnstileSiteKey={turnstileSiteKey}
            onClose={() => {
              setActiveModal(null);
              setPendingPostAfterAuth(null);
            }}
            onSuccess={handleAuthSuccess}
          />
        ) : null}
        {recoveryCode ? <RecoveryModal t={t} code={recoveryCode} onDone={finishRecovery} /> : null}
        {activeModal === "need" && user ? (
          <NeedModal
            t={t}
            language={language}
            user={user}
            initialCity={defaultCity}
            initialPostType={draftPostType}
            turnstileSiteKey={turnstileSiteKey}
            onClose={() => setActiveModal(null)}
            onPublished={(postType) => {
              setActiveModal(null);
              void refreshAfterChange(
                postType === "need"
                  ? t("reportPublished")
                  : postType === "offer"
                    ? t("helpPublished")
                    : t("updatePublished"),
                false
              );
            }}
          />
        ) : null}
        {activeModal === "donate" ? (
          <DonateModal
            t={t}
            onClose={() => setActiveModal(null)}
            onBrowseNeeds={() => {
              setActiveModal(null);
              setTab("needs");
              document.getElementById("community-feed")?.scrollIntoView({ behavior: "smooth" });
            }}
            onPostAvailableHelp={openAvailableHelp}
          />
        ) : null}
        {activeModal === "sources" ? (
          <SourcesModal
            t={t}
            language={language}
            hazards={null}
            onClose={() => setActiveModal(null)}
          />
        ) : null}
        {activeModal === "inbox" && user ? (
          <InboxModal
            t={t}
            language={language}
            user={user}
            offers={offers}
            loading={inboxLoading}
            loadError={inboxError}
            onRefresh={() => void loadInbox(true)}
            onClose={() => setActiveModal(null)}
            onChanged={(message) => void refreshAfterChange(message, false)}
          />
        ) : null}
        {activeModal === "admin" && user?.role === "moderator" ? (
          <AdminModal
            t={t}
            language={language}
            reports={reports}
            onClose={() => setActiveModal(null)}
            onDeleted={async (message) => {
              setToast(message);
              await loadPublicData();
            }}
          />
        ) : null}
        {selectedReport && activeModal === null && !recoveryCode ? (
          <ReportModal
            t={t}
            language={language}
            report={selectedReport}
            user={user}
            hazards={null}
            onClose={() => setSelectedReportId(null)}
            onRequireAuth={() => setActiveModal("auth")}
            onChanged={(message) => void refreshAfterChange(message)}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
