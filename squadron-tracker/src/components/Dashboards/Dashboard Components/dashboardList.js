//TODO: Flight Points Dashboard
//TODO: End of Year Certificate Dashboard
//TODO: Uniform & Attendance Dashboard
//TODO: PTS Dashboard

import CadetsDashboard from "../Cadets Dashboard/CadetsDashboard";
import MassEventLog from ".././Mass Event Log/MassEventLog";
import EventCategoriesDashboard from "../Event Categories Dashboard/EventCategoriesDashboard";
import ClassificationDashboard from "../Classification Dashboard/ClassificationDashboard";
import AdminDashboard from "../Admin Dashboard/AdminDashboard";
import FightPointsDashboard from "../Flight Points Dashboard/FightPointsDashboard";
import CertificateDashboard from "../Certificate Dashboard/CertificateDashboard";
import PTSTracker from "../PTS Tracker/PTSTracker";
import SystemAdminDashboard from "../System Admin Dashboard/SystemAdminDashboard"; // Import the new dashboard

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
    component: FightPointsDashboard,
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