// Chattrutterna behöver ingen egen layout längre: RealtidsProvider monteras numera i
// PrivatSkal (som chattsidorna renderar inuti), så Supabase Broadcast-signalerna når hela
// privatpersonsdelen. Layouten är kvar som ren passthrough för att inte ändra route-trädet.
export default function ChattLayout({ children }) {
  return children;
}
