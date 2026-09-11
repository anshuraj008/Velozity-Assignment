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
          <stop offset="0%" stopColor="#087D72" />
          <stop offset="55%" stopColor="#0F9787" />
          <stop offset="100%" stopColor="#21BFA6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#flowdesk-gradient)" />
      {/* Crisp geometric F mark with subtle connected node */}
      <path
        d="M12.5 11C12.5 10.17 13.17 9.5 14 9.5H27.5C28.33 9.5 29 10.17 29 11C29 11.83 28.33 12.5 27.5 12.5H16V16.5H24.5C25.33 16.5 26 17.17 26 18C26 18.83 25.33 19.5 24.5 19.5H16V28.5C16 29.33 15.33 30 14.5 30C13.67 30 13 29.33 13 28.5V11C13 11 12.5 11 12.5 11Z"
        fill="#FFFFFF"
      />
      <circle cx="24.5" cy="26" r="2.2" fill="#F0EDE4" />
    </svg>
  );
}

export function FlowDeskLogo({
  size = 32,
  collapsed = false,
  variant = 'auto',
  className = '',
}: {
  size?: number;
  collapsed?: boolean;
  variant?: 'light' | 'dark' | 'auto';
  className?: string;
}) {
  const variantClass = variant !== 'auto' ? `flowdesk-brand-wrapper--${variant}` : '';
  return (
    <div className={`flowdesk-brand-wrapper ${variantClass} ${className}`.trim()}>
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
