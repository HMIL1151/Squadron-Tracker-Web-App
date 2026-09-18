import { lazy } from "react";

/*
 * Dashboards are loaded on demand.
 *
 * Only one is ever on screen, and the Certificate dashboard alone pulls in
 * jspdf, jszip and react-pdf -- a large chunk that most users never open.
 * React.lazy plus the Suspense boundary in App.jsx keeps them out of the
 * initial download.
 *
 * Since the Muster rebuild each entry can carry TWO views of the same screen,
 * and both are lazy, so nobody downloads the interface they are not using.
 */

const CadetsDashboard = lazy(() => import("../CadetsDashboard/CadetsDashboard"));
const MassEventLog = lazy(() => import("../MassEventLog/MassEventLog"));
const EventCategoriesDashboard = lazy(() => import("../EventCategoriesDashboard/EventCategoriesDashboard"));
const ClassificationDashboard = lazy(() => import("../ClassificationDashboard/ClassificationDashboard"));
const AdminDashboard = lazy(() => import("../AdminDashboard/AdminDashboard"));
const FlightPointsDashboard = lazy(() => import("../FlightPointsDashboard/FlightPointsDashboard"));
const CertificateDashboard = lazy(() => import("../CertificateDashboard/CertificateDashboard"));
const PTSTracker = lazy(() => import("../PTSTracker/PTSTracker"));
const FlightsDashboard = lazy(() => import("../FlightsDashboard/FlightsDashboard"));
const SystemAdminDashboard = lazy(() => import("../SystemAdminDashboard/SystemAdminDashboard"));

/*
 * Muster views, added one screen at a time.
 *
 * A screen with no `muster` entry falls back to its classic component, which
 * is what makes an incremental rollout possible: the interface switch works
 * from the day it shipped, and converting a screen is an additive change
 * rather than a step in a migration that has to complete before anyone can
 * use anything. It also means a Muster view that turns out to be wrong can be
 * removed without leaving a hole in the navigation.
 */
const MusterMassEventLog = lazy(() => import("../MassEventLog/MusterMassEventLog"));
const MusterCadetList = lazy(() => import("../CadetsDashboard/MusterCadetList"));
const MusterClassification = lazy(() => import("../ClassificationDashboard/MusterClassification"));
const MusterPTSTracker = lazy(() => import("../PTSTracker/MusterPTSTracker"));
const MusterFlightPoints = lazy(() => import("../FlightPointsDashboard/MusterFlightPoints"));
const MusterCertificates = lazy(() => import("../CertificateDashboard/MusterCertificates"));
const MusterStatistics = lazy(() => import("../StatisticsDashboard/MusterStatistics"));

/*
 * Navigation groups, used by the Muster rail.
 *
 * Classic renders one flat list of ten and ignores this entirely. Ten
 * undifferentiated items is the kind of menu people learn by position rather
 * than by reading, which is why Muster groups them by what you are trying to
 * do: write something down, check how someone is getting on, or look at the
 * squadron as a whole.
 *
 * Order here is the order they appear.
 */
export const DASHBOARD_GROUPS = [
  { key: "records", title: "Records" },
  { key: "progress", title: "Progress" },
  { key: "squadron", title: "Squadron" },
];

const dashboardList = [
  {
    key: "masseventlog",
    title: "Mass Event Log",
    musterTitle: "Mass event log",
    group: "records",
    views: { classic: MassEventLog, muster: MusterMassEventLog },
    adminOnly: false, // Accessible to all users
  },
  {
    key: "dashboard",
    title: "Cadet List",
    musterTitle: "Cadet list",
    group: "records",
    views: { classic: CadetsDashboard, muster: MusterCadetList },
    adminOnly: false, // Accessible to all users
  },
  {
    key: "eventcategoriesdashboard",
    title: "Record Categories",
    musterTitle: "Record categories",
    group: "records",
    views: { classic: EventCategoriesDashboard },
    adminOnly: false, // Accessible to all users
  },
  {
    key: "classificationdashboard",
    title: "Classification Tracker",
    musterTitle: "Classification tracker",
    group: "progress",
    views: { classic: ClassificationDashboard, muster: MusterClassification },
    adminOnly: false, // Accessible to all users
  },
  {
    key: "flightpointsdashboard",
    title: "Flight Points",
    musterTitle: "Flight points",
    group: "squadron",
    views: { classic: FlightPointsDashboard, muster: MusterFlightPoints },
    adminOnly: false, // Accessible to all users
  },
  {
    key: "certificatedashboard",
    title: "Certificates",
    musterTitle: "Certificates",
    group: "progress",
    views: { classic: CertificateDashboard, muster: MusterCertificates },
    adminOnly: false, // Accessible to all users
  },
  {
    key: "ptstracker",
    title: "PTS Tracker",
    musterTitle: "PTS tracker",
    group: "progress",
    views: { classic: PTSTracker, muster: MusterPTSTracker },
    adminOnly: false, // Accessible to all users
  },
  {
    /*
     * Muster only, because it is a screen the classic interface never had
     * rather than a redesign of one it did. Menu filters these out, so the
     * classic navigation is exactly as long as it always was.
     */
    key: "statisticsdashboard",
    title: "Squadron Statistics",
    musterTitle: "Squadron statistics",
    group: "squadron",
    views: { muster: MusterStatistics },
    musterOnly: true,
    adminOnly: false,
  },
  {
    key: "flightsdashboard",
    title: "Flights",
    musterTitle: "Flights",
    group: "squadron",
    views: { classic: FlightsDashboard },
    adminOnly: true, // Changing flights affects every cadet's records
  },
  {
    key: "admin",
    title: "Admin Area",
    musterTitle: "Admin area",
    group: "squadron",
    views: { classic: AdminDashboard }, // Temporary admin page
    adminOnly: true, // Accessible only to admins
  },
  {
    key: "systemadmindashboard",
    title: "System Admin Area",
    musterTitle: "System admin area",
    group: "squadron",
    views: { classic: SystemAdminDashboard },
    adminOnly: true, // Accessible only to system admins
    systemAdminOnly: true, // Custom flag for system admins
  },
];

/**
 * The component to render for a dashboard in a given interface.
 *
 * Falls back to the classic view, which is the whole mechanism behind the
 * incremental rollout. Returns undefined only for a Muster-only screen asked
 * for in classic, which Menu already filters out.
 */
export const viewFor = (dashboard, uiVersion) =>
  dashboard?.views?.[uiVersion] ?? dashboard?.views?.classic;

/** What this dashboard is called in a given interface. */
export const titleFor = (dashboard, uiVersion) =>
  (uiVersion === "muster" && dashboard?.musterTitle) || dashboard?.title;

/**
 * The dashboards a given user may open, in a given interface.
 *
 * The permission filter is the one Menu has always applied; the interface
 * filter is new and drops screens that only exist in the other one.
 */
export const dashboardsFor = ({ uiVersion = "classic", isAdmin = false, user = null } = {}) =>
  dashboardList.filter((dashboard) => {
    if (dashboard.musterOnly && uiVersion !== "muster") return false;
    if (dashboard.systemAdminOnly) return Boolean(isAdmin && user?.systemAdmin);
    if (dashboard.adminOnly) return Boolean(isAdmin);
    return true;
  });

export default dashboardList;
