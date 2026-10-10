// Handritade SVG-"klotter" som ger startsidan ett eget, icke-mall-aktigt uttryck.
// Alla är dekorativa (aria-hidden) och ritar i currentColor, så färgen styrs med en
// text-färgklass på elementet (t.ex. className="text-korall"). Pathsen är medvetet lite
// ojämna för en handgjord känsla. Storlek styrs via className (w-*/h-*).

// Ojämn markör-understrykning under ett nyckelord.
export function Understrykning({ className = '' }) {
  return (
    <svg
      viewBox="0 0 220 18"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M4 11.5C44 6 92 4.5 141 6.5c26 1.1 51 3 73 6.2C196 15 150 13.8 112 13.2 74 12.6 34 12.8 7 15.5"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Handritad cirkel/ring runt text eller ett element.
export function Cirkel({ className = '' }) {
  return (
    <svg
      viewBox="0 0 240 110"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M131 7C77 3 28 14 13 39c-14 24 10 50 62 59 55 10 123 4 148-18 20-18 9-44-33-58C156 11 139 9 120 7"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Böjd handritad pil (med spets). Rotera via className (t.ex. rotate-90).
export function Pil({ className = '' }) {
  return (
    <svg
      viewBox="0 0 90 70"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 8c22 6 44 20 54 40 2 4 3 9 4 14"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M49 58c6 2 12 3 17 4m0 0c1-6 3-11 6-16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Liten skiss-stjärna / gnista som strödekor.
export function Stjarna({ className = '' }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <path
        d="M20 3c1.5 8 6 12.5 14 14-8 1.5-12.5 6-14 14-1.5-8-6-12.5-14-14 8-1.5 12.5-6 14-14Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Handritad bock – ersätter checkmark-ikoner i prislistan.
export function Bock({ className = '' }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 15c3 2 6 5 8 8C15 15 20 7 26 3"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Vågig avdelare – kan läggas mellan färgband.
export function Vaglinje({ className = '' }) {
  return (
    <svg
      viewBox="0 0 400 20"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M0 10c33-12 67 12 100 0s67-12 100 0 67 12 100 0 67-12 100 0"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
