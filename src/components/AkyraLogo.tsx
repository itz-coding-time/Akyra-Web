interface AkyraLogoProps {
  className?: string
}

export function AkyraLogo({ className }: AkyraLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M50 10L90 80H10L50 10Z"
        stroke="white"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M50 10V80"
        stroke="white"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <path
        d="M30 45L50 80L70 45"
        stroke="#E63946"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
