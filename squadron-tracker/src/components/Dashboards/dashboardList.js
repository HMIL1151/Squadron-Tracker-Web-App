import CadetsDashboard from "./CadetsDashboard/CadetsDashboard";
import MassEventLog from "./Mass Event Log/MassEventLog";
import EventCategoriesDashboard from "./EventCategoriesDashboard/EventCategoriesDashboard";
import ClassificationDashboard from "./ClassificationDashboard/ClassificationDashboard";
import AdminDashboard from "./AdminDashboard/AdminDashboard";

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
    title: "Classification Dashboard",
    component: ClassificationDashboard,
    adminOnly: false, // Accessible to all users
  },



  {
    key: "admin",
    title: "Admin Area",
    component: AdminDashboard, // Temporary admin page
    adminOnly: true, // Accessible only to admins
  },
];

export default dashboardList;