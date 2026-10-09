// Baskort med mjuk skugga – speglar frontend/src/components/Kort.js och STIL.kort.
export default function Kort({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-yta rounded-md p-4 shadow-mjuk ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
