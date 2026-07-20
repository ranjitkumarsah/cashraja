import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { login, setupTotp, verifyTotp } from '../../lib/api/admin-auth';
import { apiErrorMessage } from '../../lib/api/client';
import { isSessionResult, type AdminSessionResult } from '../../lib/api/types';
import { useAuth } from '../../lib/auth/auth-context';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { CoinMark } from '../../components/CoinMark';
import {
  loginSchema,
  totpCodeSchema,
  type LoginFormValues,
  type TotpCodeFormValues,
} from './schemas';

/**
 * Login state machine. The backend answers /login with one of:
 *  - { access_token, admin }                        → session (defensive branch)
 *  - { totp_required, challenge_token }             → 6-digit code step
 *  - { totp_setup_required, challenge_token,
 *      otpauth_url }                                → QR enrolment + code step
 */
type Step =
  | { kind: 'credentials' }
  | { kind: 'totp'; challengeToken: string }
  | { kind: 'totp-setup'; challengeToken: string; otpauthUrl: string };

export function LoginPage() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [error, setError] = useState<string | null>(null);

  const handleSession = (session: AdminSessionResult) => {
    setError(null);
    // RedirectIfAuthed re-routes to the dashboard as soon as the store updates.
    signIn(session);
  };

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      setError(null);
      if (isSessionResult(result)) {
        handleSession(result);
      } else if (result.totp_setup_required) {
        setStep({
          kind: 'totp-setup',
          challengeToken: result.challenge_token,
          otpauthUrl: result.otpauth_url ?? '',
        });
      } else {
        setStep({ kind: 'totp', challengeToken: result.challenge_token });
      }
    },
    onError: (err) => setError(apiErrorMessage(err, 'Sign-in failed. Check your credentials.')),
  });

  const totpMutation = useMutation({
    mutationFn: (input: { challengeToken: string; code: string; setup: boolean }) =>
      (input.setup ? setupTotp : verifyTotp)({
        challenge_token: input.challengeToken,
        code: input.code,
      }),
    onSuccess: handleSession,
    onError: (err) =>
      setError(apiErrorMessage(err, 'Invalid or expired code. Try again or start over.')),
  });

  const restart = () => {
    setError(null);
    totpMutation.reset();
    loginMutation.reset();
    setStep({ kind: 'credentials' });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface p-4">
      {/* Subtle indigo radial glow — premium, not flashy. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(79, 70, 229, 0.16), transparent 60%), ' +
            'radial-gradient(40rem 30rem at 85% 110%, rgba(184, 134, 11, 0.08), transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <CoinMark className="size-14 drop-shadow-md" />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Cash <span className="text-gold-500">Raja</span>
            </h1>
            <p className="mt-0.5 text-sm font-medium uppercase tracking-[0.2em] text-ink-faint">
              Admin Console
            </p>
          </div>
        </div>

        <Card className="shadow-lg shadow-primary-950/10">
          <CardContent className="p-7">
            {step.kind === 'credentials' && (
              <CredentialsForm
                submitting={loginMutation.isPending}
                onSubmit={(values) => loginMutation.mutate(values)}
              />
            )}

            {step.kind === 'totp' && (
              <TotpForm
                title="Two-factor verification"
                description="Enter the 6-digit code from your authenticator app."
                icon={<ShieldCheck className="size-6 text-primary-600" aria-hidden="true" />}
                submitting={totpMutation.isPending}
                onSubmit={({ code }) =>
                  totpMutation.mutate({ challengeToken: step.challengeToken, code, setup: false })
                }
                onRestart={restart}
              />
            )}

            {step.kind === 'totp-setup' && (
              <TotpForm
                title="Set up two-factor authentication"
                description="Scan this QR code with your authenticator app, then enter the 6-digit code it shows to finish enrolment."
                icon={<KeyRound className="size-6 text-gold-500" aria-hidden="true" />}
                qr={
                  <div className="flex justify-center">
                    <div
                      className="rounded-xl border border-edge bg-white p-3 shadow-sm"
                      role="img"
                      aria-label="TOTP setup QR code"
                    >
                      <QRCodeSVG value={step.otpauthUrl} size={168} marginSize={1} />
                    </div>
                  </div>
                }
                submitting={totpMutation.isPending}
                onSubmit={({ code }) =>
                  totpMutation.mutate({ challengeToken: step.challengeToken, code, setup: true })
                }
                onRestart={restart}
              />
            )}

            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-900/40 dark:text-danger-500">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Restricted area. Every action is audited.
        </p>
      </div>
    </div>
  );
}

function CredentialsForm({
  submitting,
  onSubmit,
}: {
  submitting: boolean;
  onSubmit: (values: LoginFormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold text-ink">Welcome back</h2>
        <p className="text-sm text-ink-muted">Sign in with your admin credentials.</p>
      </div>
      <Input
        label="Email"
        type="email"
        autoComplete="username"
        placeholder="admin@cashraja.app"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" className="w-full" size="lg" loading={submitting}>
        Sign in
      </Button>
    </form>
  );
}

function TotpForm({
  title,
  description,
  icon,
  qr,
  submitting,
  onSubmit,
  onRestart,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  qr?: React.ReactNode;
  submitting: boolean;
  onSubmit: (values: TotpCodeFormValues) => void;
  onRestart: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TotpCodeFormValues>({ resolver: zodResolver(totpCodeSchema) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="space-y-2 text-center">
        <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      {qr}
      <Input
        label="Authentication code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        className="coin-num text-center text-lg tracking-[0.4em]"
        error={errors.code?.message}
        {...register('code')}
      />
      <Button type="submit" className="w-full" size="lg" loading={submitting}>
        Verify
      </Button>
      <button
        type="button"
        onClick={onRestart}
        className="mx-auto flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Start over
      </button>
    </form>
  );
}
