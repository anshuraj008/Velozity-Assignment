export function FlowDeskIcon({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="flowdesk-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="55%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient id="flowdesk-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#flowdesk-gradient)" />
      {/* Dynamic F-shaped flow stream */}
      <path
        d="M12 11.5C12 10.67 12.67 10 13.5 10H27.5C28.33 10 29 10.67 29 11.5C29 12.33 28.33 13 27.5 13H16V17H24.5C25.33 17 26 17.67 26 18.5C26 19.33 25.33 20 24.5 20H16V28.5C16 29.33 15.33 30 14.5 30C13.67 30 13 29.33 13 28.5V11.5H12Z"
        fill="#FFFFFF"
      />
      {/* Live sync pulse indicator */}
      <circle cx="25.5" cy="26" r="3.2" fill="url(#flowdesk-accent)" />
    </svg>
  );
}

export function FlowDeskLogo({
  size = 32,
  collapsed = false,
}: {
  size?: number;
  collapsed?: boolean;
}) {
  return (
    <div className="flowdesk-brand-wrapper">
      <FlowDeskIcon size={size} className="flowdesk-brand-icon" />
      {!collapsed && (
        <span className="flowdesk-brand-text">
          <span className="flowdesk-brand-flow">Flow</span>
          <span className="flowdesk-brand-desk">Desk</span>
          <span className="flowdesk-brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
