import CadetsDashboard from "./CadetsDashboard/CadetsDashboard";
import MassEventLog from "./Mass Event Log/MassEventLog";
import EventCategoriesDashboard from "./EventCategoriesDashboard/EventCategoriesDashboard";

const dashboardList = [
  {
    key: "masseventlog",
    title: "Mass Event Log",
    component: MassEventLog,
  },
  {
    key: "dashboard",
    title: "Cadet List",
    component: CadetsDashboard,
  },
  {
    key: "eventcategoriesdashboard",
    title: "Event Categories",
    component: EventCategoriesDashboard,
  },
];

export default dashboardList;