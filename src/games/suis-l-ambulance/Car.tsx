export function Car({ ambulance }: { ambulance?: boolean }) {
  const body = ambulance ? '#F7F7FA' : '#F5B800'
  return (
    <svg viewBox="0 0 40 72" className="h-full w-auto drop-shadow-[0_4px_6px_rgba(0,0,0,.55)]" aria-hidden>
      <rect x="2" y="3" width="36" height="66" rx="10" fill={body} />
      <rect x="6" y="14" width="28" height="12" rx="3" fill="#1d2233" />
      <rect x="7" y="52" width="26" height="8" rx="3" fill="#1d2233" />
      <rect x="6" y="28" width="28" height="22" rx="3" fill={ambulance ? '#ffffff' : '#E6A800'} />
      {ambulance ? (<>
        <rect x="2" y="44" width="36" height="4" fill="#F0435A" />
        <rect x="17" y="31" width="6" height="16" fill="#2F6BFF" /><rect x="12" y="36" width="16" height="6" fill="#2F6BFF" />
        <rect x="9" y="7" width="10" height="5" rx="1.5" fill="#F0435A" /><rect x="21" y="7" width="10" height="5" rx="1.5" fill="#2F6BFF" />
      </>) : (<rect x="13" y="35" width="14" height="6" rx="1.5" fill="#222" />)}
      <rect x="0" y="16" width="3" height="6" rx="1" fill="#111" /><rect x="37" y="16" width="3" height="6" rx="1" fill="#111" />
    </svg>
  )
}
