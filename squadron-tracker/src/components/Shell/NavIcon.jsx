/**
 * The little line drawings in the Muster navigation rail.
 *
 * Inline SVG rather than an icon font or a package: there are ten of them,
 * they never change, and a dependency that ships four hundred icons to deliver
 * ten is a dependency that has to be kept up to date forever.
 *
 * Each is a single `d`, drawn on a 16-unit grid, stroked with currentColor so
 * it follows the link's own colour through hover and the active state without
 * anything having to know the palette.
 *
 * Keyed by dashboard key rather than by an icon name, so adding a dashboard
 * without an icon is a missing picture rather than a crash, and so the rail
 * never has to carry a mapping of its own.
 */
const PATHS = {
  masseventlog: "M3 3.5h10M3 8h10M3 12.5h6",
  dashboard: "M8 8.1a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2M2.8 13.6a5.4 5.4 0 0 1 10.4 0",
  eventcategoriesdashboard:
    "M2.4 2.4h4.6v4.6H2.4zM9 2.4h4.6v4.6H9zM2.4 9h4.6v4.6H2.4zM9 9h4.6v4.6H9z",
  classificationdashboard: "M2.5 13.5V9M6.5 13.5V5.5M10.5 13.5V7.5M14 13.5V2.8",
  ptstracker: "M8 2.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2M5.6 9.3 4.6 14l3.4-1.8L11.4 14l-1-4.7",
  certificatedashboard: "M2.4 2.6h11.2v8.4H2.4zM5.4 13.4h5.2",
  statisticsdashboard: "M2.5 13.5h11M4.5 11.5V7.4M8 11.5V3.4M11.5 11.5V8.6",
  flightpointsdashboard: "M8 2.2 14 8l-6 5.8L2 8Z",
  flightsdashboard: "M2.6 12.4V4.2l5.4 2.2 5.4-2.2v8.2l-5.4 2.2Z",
  admin:
    "M8 5.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6M8 1.6v2M8 12.4v2M14.4 8h-2M3.6 8h-2M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4M12.5 12.5l-1.4-1.4M4.9 4.9 3.5 3.5",
  systemadmindashboard:
    "M4.2 2.6h7.6v3.2H4.2zM4.2 10.2h7.6v3.2H4.2zM6.2 4.2h.01M6.2 11.8h.01",
};

const NavIcon = ({ name }) => {
  const d = PATHS[name];
  if (!d) return null;

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
};

export default NavIcon;
