'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, roleLabel } from '@/lib/utils';
import { Users, UserPlus, Mail, UserX } from 'lucide-react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  SUPERVISOR: 'bg-gray-100 text-gray-700',
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MANAGER' | 'SUPERVISOR'>('SUPERVISOR');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => { const res = await api.get('/api/users'); return res.data.data; },
  });

  const { data: invites } = useQuery<Invite[]>({
    queryKey: ['invites'],
    queryFn: async () => { const res = await api.get('/api/users/invites'); return res.data.data; },
  });

  const sendInvite = useMutation({
    mutationFn: () => api.post('/api/users/invite', { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      setInviteEmail('');
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setShowInviteForm(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed to send invite';
      setInviteError(msg);
    },
  });

  const revokeInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.patch(`/api/users/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const pendingInvites = invites?.filter((i) => i.status === 'PENDING') || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your organization's users and invitations</p>
          </div>
          <Button onClick={() => { setShowInviteForm(!showInviteForm); setInviteError(''); setInviteSuccess(''); }}>
            <UserPlus className="mr-2 h-4 w-4" />Invite User
          </Button>
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <Card>
            <CardHeader><CardTitle>Send Invitation</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                >
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <Button onClick={() => { setInviteError(''); sendInvite.mutate(); }} loading={sendInvite.isPending}>
                  <Mail className="mr-2 h-4 w-4" />Send
                </Button>
              </div>
              {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
            </CardContent>
          </Card>
        )}

        {inviteSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3">
            <p className="text-sm text-green-700">{inviteSuccess}</p>
          </div>
        )}

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Pending Invitations</CardTitle></CardHeader>
            <CardContent className="divide-y divide-gray-100 p-0">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                    <p className="text-xs text-gray-500">Expires {formatDateTime(invite.expiresAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={roleColors[invite.role]}>{roleLabel(invite.role)}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => revokeInvite.mutate(invite.id)}>
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Users list */}
        <Card>
          <CardHeader><CardTitle>Team Members ({users?.length ?? 0})</CardTitle></CardHeader>
          <CardContent className="divide-y divide-gray-100 p-0">
            {!users?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Users className="mb-3 h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500">No team members yet</p>
              </div>
            ) : (
              users.map((user) => (
                <div key={user.id} className={`flex items-center justify-between px-6 py-4 ${!user.isActive ? 'opacity-50' : ''}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                      {!user.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <p className="text-xs text-gray-400">
                      Last login: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={roleColors[user.role]}>{roleLabel(user.role)}</Badge>
                    {user.isActive && (
                      <Button variant="ghost" size="sm" onClick={() => deactivate.mutate(user.id)}>
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
