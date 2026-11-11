/**
 * 品牌标:三根上升的柱,最高的一根是"钱"的绿 —— 已验证的收入。
 * 形状与社交账号头像一致(public/brand),颜色随设计系统走:主色蓝 + 绿。
 * `onInk` 用在深色页脚/蓝面板上:柱子改成白色。
 */
export default function Logo({ size = 20, onInk = false }: { size?: number; onInk?: boolean }) {
  const bar = onInk ? "#ffffff" : "#1f5eff";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1.5" y="14" width="4.5" height="8.5" rx="1.6" fill={bar} opacity="0.4" />
      <rect x="9.75" y="9" width="4.5" height="13.5" rx="1.6" fill={bar} opacity="0.75" />
      <rect x="18" y="1.5" width="4.5" height="21" rx="1.6" fill={onInk ? "#3fd99a" : "#10a86b"} />
    </svg>
  );
}
