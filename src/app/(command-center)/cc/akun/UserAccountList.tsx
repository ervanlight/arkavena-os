'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Card } from '@/core/ui';
import { UserAccountCard } from './UserAccountCard';
import type { ExternalUserWithProjects } from '@/modules/access-management/actions';

interface Props {
  allUsers: ExternalUserWithProjects[];
}

export function UserAccountList({ allUsers }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredUsers = allUsers.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (roleFilter === 'all') return true;

    return user.projects.some((p) => p.role === roleFilter);
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[color:var(--color-ink-tertiary)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama atau ID login..."
            className="w-full rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="h-4 w-4 text-[color:var(--color-ink-tertiary)]" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-ink)] focus:outline-none"
          >
            <option value="all">Semua Tipe Role</option>
            <option value="subcontractor">Subkontraktor</option>
            <option value="photo_uploader">Pengawas</option>
            <option value="client_approver">Klien Approver</option>
            <option value="client_viewer">Klien Viewer</option>
          </select>
        </div>
      </div>

      {/* User list */}
      {filteredUsers.length === 0 ? (
        <Card>
          <p className="text-sm text-[color:var(--color-ink-secondary)] text-center py-6">
            {searchTerm || roleFilter !== 'all'
              ? 'Tidak ada akun yang sesuai dengan pencarian/filter.'
              : 'Belum ada akun eksternal. Gunakan form di atas untuk membuat akun pertama.'}
          </p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[color:var(--color-hairline)]">
            {filteredUsers.map((user) => (
              <UserAccountCard key={user.userId} user={user} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
