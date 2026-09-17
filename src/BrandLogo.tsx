type Props = {
  size?: "sm" | "lg"
  variant?: "light" | "dark" | "gray"
}

export default function BrandLogo({ size = "sm", variant = "light" }: Props) {
  const dim    = size === "sm" ? 38 : 54
  const radius = size === "sm" ? 13 : 18
  const svgSize = size === "sm" ? 22 : 32

  const bg =
    variant === "dark" ? "linear-gradient(135deg, rgba(91,99,211,0.96) 0%, rgba(157,164,246,0.82) 100%)"
    : variant === "gray" ? "linear-gradient(145deg, #3e3e48 0%, #5c5c6a 100%)"
    : "linear-gradient(135deg, rgba(105,82,240,0.98) 0%, rgba(168,130,255,0.88) 100%)"

  const shadow =
    variant === "dark" ? "0 8px 20px rgba(91,99,211,0.22), inset 0 1px 0 rgba(255,255,255,0.14)"
    : variant === "gray" ? "0 6px 18px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.18)"
    : "0 8px 20px rgba(101,86,172,0.22), inset 0 1px 0 rgba(255,255,255,0.28)"

  const stroke =
    variant === "dark" ? "rgba(9,10,12,0.92)"
    : variant === "gray" ? "rgba(255,255,255,0.88)"
    : "rgba(255,255,255,0.96)"

  const gloss =
    variant === "dark" ? "radial-gradient(circle at 35% 22%, rgba(255,255,255,0.16), transparent 60%)"
    : variant === "gray" ? "radial-gradient(circle at 35% 22%, rgba(255,255,255,0.14), transparent 60%)"
    : "radial-gradient(circle at 35% 22%, rgba(255,255,255,0.22), transparent 60%)"

  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: radius,
        background: bg,
        boxShadow: shadow,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: gloss,
          pointerEvents: "none",
        }}
      />

      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "relative", zIndex: 1 }}
      >
        {/* Finial */}
        <circle cx="12" cy="3.2" r="1.3" fill={stroke} />

        {/* Central pillar */}
        <line x1="12" y1="3.2" x2="12" y2="18.5"
          stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />

        {/* Crossbar */}
        <line x1="3.5" y1="7.5" x2="20.5" y2="7.5"
          stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />

        {/* Left chain */}
        <line x1="3.5" y1="7.5" x2="3.5" y2="12"
          stroke={stroke} strokeWidth="1.1" strokeLinecap="round"
          style={{ opacity: 0.78 }} />

        {/* Right chain */}
        <line x1="20.5" y1="7.5" x2="20.5" y2="12"
          stroke={stroke} strokeWidth="1.1" strokeLinecap="round"
          style={{ opacity: 0.78 }} />

        {/* Left pan */}
        <path d="M1.2 12 Q3.5 16 5.8 12"
          stroke={stroke} strokeWidth="1.4" strokeLinecap="round"
          fill={variant === "dark" ? "rgba(9,10,12,0.1)" : "rgba(255,255,255,0.14)"} />

        {/* Right pan */}
        <path d="M18.2 12 Q20.5 16 22.8 12"
          stroke={stroke} strokeWidth="1.4" strokeLinecap="round"
          fill={variant === "dark" || variant === "gray" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)"} />

        {/* Base bar */}
        <line x1="8.5" y1="18.5" x2="15.5" y2="18.5"
          stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />

        {/* Left foot */}
        <line x1="7" y1="20.8" x2="10.5" y2="18.5"
          stroke={stroke} strokeWidth="1.2" strokeLinecap="round"
          style={{ opacity: 0.7 }} />

        {/* Right foot */}
        <line x1="17" y1="20.8" x2="13.5" y2="18.5"
          stroke={stroke} strokeWidth="1.2" strokeLinecap="round"
          style={{ opacity: 0.7 }} />
      </svg>
    </div>
  )
}
