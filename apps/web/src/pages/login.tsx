import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Check, Activity } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErrorNotice } from '../components/ui';
import { FlowDeskLogo } from '../components/logo';
export function Login() {
  const { login } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login(String(data.get('email')), String(data.get('password')));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <FlowDeskLogo size={36} variant="dark" />
        </div>
        <div className="login-story-content">
          <span className="eyebrow">ONE TEAM. A SHARED PICTURE.</span>
          <h1>
            Make room
            <br />
            for great work.
          </h1>
          <p>
            From the first brief to the final handoff.
            <br />A calmer place to move your projects forward.
          </p>
          <div className="login-preview">
            <div className="preview-header">
              <span className="preview-icon">
                <Activity size={18} />
              </span>
              <strong>Progress, in real time</strong>
              <span className="live-pill">
                <span className="connection-dot online" />
                Live
              </span>
            </div>
            <div className="preview-task">
              <span className="preview-check">
                <Check size={15} />
              </span>
              <div>
                <strong>A little less chasing.</strong>
                <p>A little more creating.</p>
              </div>
              <span className="preview-avatars">
                <b>AM</b>
                <b>SR</b>
                <b>PS</b>
              </span>
            </div>
            <div className="preview-line">
              <span />
            </div>
            <div className="preview-bottom">
              <span>Every detail, connected.</span>
              <ArrowRight size={16} />
            </div>
          </div>
        </div>
        <span className="login-copyright">Built around the way teams work.</span>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <span className="login-welcome">YOUR WORKSPACE AWAITS</span>
          <h2>Welcome back.</h2>
          <p>Sign in to pick up where your team left off.</p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@company.com"
                maxLength={254}
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {Boolean(error) && <ErrorNotice error={error} />}
            <button className="button primary login-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to workspace'}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="login-help">Need an account? Contact your workspace admin.</div>
        </div>
        <span className="login-secure">Your projects. Your people. One workspace.</span>
      </section>
    </div>
  );
}
