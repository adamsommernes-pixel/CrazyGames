/** Repgrade-logoen (samme som app-ikonet) med navnet ved siden av. Diskret som standard. */
export function Logo({ size = 18, name = true, className = '' }: { size?: number; name?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={size} height={size} alt={name ? '' : 'Repgrade'} className="shrink-0 rounded-[22%]" />
      {name && <span className="font-num font-bold tracking-tight">Repgrade</span>}
    </span>
  );
}
