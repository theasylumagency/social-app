import type { CSSProperties } from "react"

const paths = {
  week: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-13 5h3"/></>,
  content: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h3"/></>,
  results: <><path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6"/></>,
  brand: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
  connections: <><path d="m9 15 6-6m-8 4-2 2a4 4 0 0 0 6 6l3-3m-4-12 3-3a4 4 0 0 1 6 6l-2 2"/></>,
  settings: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  down: <path d="m6 9 6 6 6-6"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/></>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/></>,
  edit: <><path d="m15 4 5 5-11 11H4v-5L15 4Z"/><path d="m12 7 5 5"/></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/></>,
  facebook: <path d="M14 21v-9h3l1-4h-4V6c0-1 1-2 2-2h2V1h-3c-4 0-5 3-5 5v2H7v4h3v9"/>,
} as const

export type IconName = keyof typeof paths
export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg aria-hidden="true" className={className} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
