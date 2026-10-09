// Rött felmeddelande under ett formulärfält – speglar frontend/src/components/FältFel.js.
// Renderar null när det är tomt, så det är ofarligt att alltid inkludera.
export default function FältFel({ children }) {
  if (!children) return null;
  return <p className="text-[13px] font-medium text-fel">{children}</p>;
}
