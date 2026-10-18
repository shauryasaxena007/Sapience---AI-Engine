
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import Icon from '../components/Icon.jsx';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    
try {
  if (isLogin) {
    await login(form.email, form.password);
    navigate('/chat', { replace: true });
  }  else {
  await register(
    form.displayName.trim(),
    form.email.trim(),
    form.password
  );
  navigate('/chat', { replace: true });
}
} catch (err) {
  setError(err.message || 'Something went wrong. Please try again.');
} finally {
  setBusy(false);
}

  };
  


  return (
    <main className="relative min-h-full overflow-hidden bg-paper">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* Left brand panel */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-accent p-10 text-accent-ink lg:flex xl:p-14">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-current opacity-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full border border-current opacity-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute right-16 top-1/3 h-36 w-36 rounded-full border border-current opacity-10"
            aria-hidden="true"
          />

          <Link to="/login" className="relative z-10 flex w-fit items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-ink/10 text-xl">
              <Icon name="note" />
            </span>
            <span className="text-2xl font-semibold tracking-tight">
              Sapience<span className="opacity-70">.</span>
            </span>
          </Link>

          <div className="relative z-10 max-w-xl py-12">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-current/20 px-3 py-1.5 text-xs font-medium tracking-wide">
              <span className="h-2 w-2 rounded-full bg-current" />
              YOUR PERSONAL KNOWLEDGE SPACE
            </div>

            <h1 className="font-serif text-5xl leading-tight tracking-tight xl:text-6xl">
              Think clearly.
              <br />
              Discover more.
              <br />
              <span className="opacity-75">Remember what matters.</span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-7 opacity-80">
              Bring your questions, notes and ideas together in one place.
              Explore information, keep useful knowledge, and build on
              what you learn.
            </p>

            <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
              <div className="rounded-2xl border border-current/15 bg-black/5 p-4">
                <p className="text-sm font-semibold">AI-powered learning</p>
                <p className="mt-1 text-xs leading-5 opacity-70">
                  Explore ideas and find answers.
                </p>
              </div>
              <div className="rounded-2xl border border-current/15 bg-black/5 p-4">
                <p className="text-sm font-semibold">Your knowledge</p>
                <p className="mt-1 text-xs leading-5 opacity-70">
                  Keep important notes in reach.
                </p>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs opacity-65">
            A thoughtful space for everything you want to understand.
          </p>
        </section>

        {/* Right login / registration panel */}
        <section className="relative flex items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
          <div
            className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-accent/5 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative w-full max-w-md">
            {/* Mobile branding */}
            <Link
              to="/login"
              className="mb-10 flex items-center justify-center gap-2 text-xl font-semibold tracking-tight lg:hidden"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-ink">
                <Icon name="note" />
              </span>
              Sapience<span className="text-accent">.</span>
            </Link>

            <div className="card rounded-3xl p-6 shadow-sm sm:p-9">
              <div className="mb-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  {isLogin ? 'WELCOME BACK' : 'GET STARTED'}
                </p>

                <h2 className="text-3xl font-semibold tracking-tight">
                  {isLogin ? 'Sign in to Sapience' : 'Create your account'}
                </h2>

                <p className="mt-3 text-sm leading-6 text-mute">
                  {isLogin
                    ? 'Pick up where your curiosity left off.'
                    : 'Create your personal space for ideas and knowledge.'}
                </p>
              </div>

              <form onSubmit={submit} className="space-y-5">
                {!isLogin && (
                  <label className="block text-sm font-medium" htmlFor="displayName">
                    Full name
                    <input
                      id="displayName"
                      className="field mt-2 h-12"
                      type="text"
                      placeholder="Enter your name"
                      autoComplete="name"
                      maxLength={80}
                      required
                      value={form.displayName}
                      onChange={updateField('displayName')}
                    />
                  </label>
                )}

                <label className="block text-sm font-medium" htmlFor="email">
                  Email address
                  <input
                    id="email"
                    className="field mt-2 h-12"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={255}
                    required
                    value={form.email}
                    onChange={updateField('email')}
                  />
                </label>

                <label className="block text-sm font-medium" htmlFor="password">
                  Password
                  <div className="relative mt-2">
                    <input
                      id="password"
                      className="field h-12 pr-16"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isLogin ? 'Enter your password' : 'Create a strong password'}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      minLength={isLogin ? undefined : 8}
                      maxLength={128}
                      required
                      value={form.password}
                      onChange={updateField('password')}
                    />

                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 text-xs font-semibold text-mute transition-colors hover:text-ink"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {!isLogin && (
                    <span className="mt-2 block text-xs font-normal text-mute">
                      Use at least 8 characters.
                    </span>
                  )}
                </label>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary h-12 w-full rounded-xl text-sm"
                  disabled={busy}
                >
                  {busy
                    ? 'Please wait…'
                    : isLogin
                      ? 'Sign in to Sapience →'
                      : 'Create my account →'}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-xs text-mute">YOUR SPACE AWAITS</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              <p className="text-center text-sm text-mute">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                <Link
                  className="font-semibold text-accent underline-offset-4 hover:underline"
                  to={isLogin ? '/register' : '/login'}
                >
                  {isLogin ? 'Create one' : 'Sign in'}
                </Link>
              </p>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-mute">
              By continuing, you agree to use Sapience responsibly and keep
              your account credentials private.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
