/** Nomos brand mark — purple gradient tile with the display "N". Theme-agnostic. */
export default function NomosMark({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: size * 0.34,
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, rgba(105,82,240,0.98) 0%, rgba(135,105,247,0.93) 50%, rgba(168,130,255,0.88) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // The cast is a token so the gray theme can make it neutral without
        // touching the mark: that theme's backgrounds must carry no purple, and
        // this shadow is the only purple that reaches one. Light and dark keep
        // the purple glow via the fallback.
        boxShadow: `0 ${size * 0.2}px ${size * 0.5}px var(--nomos-mark-glow, rgba(101, 86, 172, 0.22))`,
        flex: 'none',
      }}
    >
      <span
        className="nomos-mark-n"
        style={{
          color: '#fff',
          fontSize: size * 0.86,
          fontWeight: 500,
          fontFamily: '"Post No Bills Jaffna Medium", Georgia, serif',
          lineHeight: 1,
        }}
      >
        N
      </span>
      {/* inner top highlight */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.28)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
