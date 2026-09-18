export default function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ps-a" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c6cff" />
          <stop offset="1" stopColor="#5b4bf5" />
        </linearGradient>
      </defs>
      {/* 三根上升柱 —— 最高那根用"钱"的绿,代表已验证的收入 */}
      <rect x="1.5" y="14" width="4.5" height="8.5" rx="1.6" fill="url(#ps-a)" opacity="0.42" />
      <rect x="9.75" y="9" width="4.5" height="13.5" rx="1.6" fill="url(#ps-a)" opacity="0.75" />
      <rect x="18" y="1.5" width="4.5" height="21" rx="1.6" fill="#10b981" />
    </svg>
  );
}
