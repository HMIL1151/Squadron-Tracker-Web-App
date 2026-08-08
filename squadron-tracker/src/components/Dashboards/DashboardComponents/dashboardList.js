//TODO: Flight Points Dashboard
//TODO: End of Year Certificate Dashboard
//TODO: Uniform & Attendance Dashboard
//TODO: PTS Dashboard

import { lazy } from "react";

/*
 * Dashboards are loaded on demand.
 *
 * Only one is ever on screen, and the Certificate dashboard alone pulls in
 * jspdf, jszip and react-pdf -- a large chunk that most users never open.
 * React.lazy plus the Suspense boundary in App.jsx keeps them out of the
 * initial download.
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

const dashboardList = [
  {
    key: "masseventlog",
    title: "Mass Event Log",
    component: MassEventLog,
    adminOnly: false, // Accessible to all users
  },
  {
    key: "dashboard",
    title: "Cadet List",
    component: CadetsDashboard,
    adminOnly: false, // Accessible to all users
  },
  {
    key: "eventcategoriesdashboard",
    title: "Record Categories",
    component: EventCategoriesDashboard,
    adminOnly: false, // Accessible to all users
  },
  {
    key: "classificationdashboard",
    title: "Classification Tracker",
    component: ClassificationDashboard,
    adminOnly: false, // Accessible to all users
  },
  {
    key: "flightpointsdashboard",
    title: "Flight Points",
    component: FlightPointsDashboard,
    adminOnly: false, // Accessible to all users
  },
  {
    key: "certificatedashboard",
    title: "End of Year Certificates",
    component: CertificateDashboard,
    adminOnly: false, // Accessible to all users
  },
  {
    key: "ptstracker",
    title: "PTS Tracker",
    component: PTSTracker,
    adminOnly: false, // Accessible to all users
  },
  {
    key: "flightsdashboard",
    title: "Flights",
    component: FlightsDashboard,
    adminOnly: true, // Changing flights affects every cadet's records
  },
  {
    key: "admin",
    title: "Admin Area",
    component: AdminDashboard, // Temporary admin page
    adminOnly: true, // Accessible only to admins
  },
  {
    key: "systemadmindashboard",
    title: "System Admin Area",
    component: SystemAdminDashboard,
    adminOnly: true, // Accessible only to system admins
    systemAdminOnly: true, // Custom flag for system admins
  },
];


export default dashboardList;