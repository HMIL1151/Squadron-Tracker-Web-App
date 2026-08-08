//TODO: Flight Points Dashboard
//TODO: End of Year Certificate Dashboard
//TODO: Uniform & Attendance Dashboard
//TODO: PTS Dashboard

import CadetsDashboard from "../CadetsDashboard/CadetsDashboard";
import MassEventLog from ".././MassEventLog/MassEventLog";
import EventCategoriesDashboard from "../EventCategoriesDashboard/EventCategoriesDashboard";
import ClassificationDashboard from "../ClassificationDashboard/ClassificationDashboard";
import AdminDashboard from "../AdminDashboard/AdminDashboard";
import FlightPointsDashboard from "../FlightPointsDashboard/FlightPointsDashboard";
import CertificateDashboard from "../CertificateDashboard/CertificateDashboard";
import PTSTracker from "../PTSTracker/PTSTracker";
import FlightsDashboard from "../FlightsDashboard/FlightsDashboard";
import SystemAdminDashboard from "../SystemAdminDashboard/SystemAdminDashboard"; // Import the new dashboard

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