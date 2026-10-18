
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    let active = true;

    async function verifyEmail() {
      if (!token) {
        setStatus('error');
        setMessage('Verification link is missing its token.');
        return;
      }

      try {
        const response = await api.post('/auth/verify-email', { token });

        if (active) {
          setStatus('success');
          setMessage(
            response?.data?.message ||
            'Your email has been verified successfully.'
          );
        }
      } catch (error) {
        if (active) {
          setStatus('error');
          setMessage(
            error?.message ||
            'This verification link is invalid or has expired.'
          );
        }
      }
    }

    verifyEmail();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl">
        <div className="mb-5 text-4xl">
          {status === 'loading' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '⚠️'}
        </div>

        <h1 className="mb-3 text-2xl font-bold">
          {status === 'loading'
            ? 'Verifying Email'
            : status === 'success'
              ? 'Email Verified!'
              : 'Verification Failed'}
        </h1>

        <p className="mb-6 text-sm text-gray-400">
          {message}
        </p>

        {status !== 'loading' && (
          <Link
            to="/login"
            className="inline-block rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition hover:bg-teal-500"
          >
            Go to Login
          </Link>
        )}
      </section>
    </main>
  );
}
