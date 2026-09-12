import { useState, useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, LoaderCircle, X, ArrowUpRight } from 'lucide-react';
import { labels, type Priority, type Status } from '@velozity/shared';
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar ${small ? 'small' : ''}`} aria-label={name}>
      {name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
export function Badge({ value }: { value: Status | Priority }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      <span className="badge-dot" />
      {labels[value]}
    </span>
  );
}
export function Loading({ fullScreen = false }: { fullScreen?: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`loading ${fullScreen ? 'loading-fullscreen' : ''}`} role="status">
      <div className="loading-card">
        <LoaderCircle size={26} className="spin" />
        <span className="loading-title">
          {seconds >= 3 ? 'Waking up server…' : 'Loading workspace…'}
        </span>
        {seconds >= 3 && (
          <p className="loading-hint">
            The free-tier backend instance spins down after inactivity and takes ~30–50s to wake up on first visit.
          </p>
        )}
        {seconds >= 6 && (
          <button
            type="button"
            className="button small-button loading-skip-btn"
            onClick={() => window.dispatchEvent(new Event('session-expired'))}
          >
            Continue to Login
          </button>
        )}
      </div>
    </div>
  );
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} />
      <span>{error instanceof Error ? error.message : 'Unable to load this information.'}</span>
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">
        <ArrowUpRight size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="drawer"
        aria-label={title}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close drawer">
            <X size={20} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(value),
  );
export function relativeDate(value: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return mins < 1
    ? 'Just now'
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : formatDate(value);
}
