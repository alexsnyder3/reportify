'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HardHat } from 'lucide-react';

function AcceptInviteForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', { token, firstName, lastName, password });
      setToken(res.data.data.token);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Invalid or expired invitation.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-red-600">No invitation token provided.</p>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <HardHat className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Reportify</h1>
            <p className="text-sm text-gray-400">Create your account</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Set up your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <Input type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Input type="password" label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" size="lg" loading={loading}>Create account</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}
