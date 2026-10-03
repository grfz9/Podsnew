import { requireBackend } from '../lib/supabase';
import type { Role } from './moderation';

/** Espace administrateur (fonctions SQL réservées aux administrateurs, vérifiées par le serveur). */

export interface AdminStats {
  members: number;
  members_7d: number;
  active_7d: number;
  premium: number;
  admins: number;
  moderators: number;
  shared_groups: number;
  validated_podcasts: number;
  pending_suggestions: number;
}

export interface Member {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: Role;
  premium: boolean;
  total: number;
}

export const PAGE_SIZE = 30;

function readable(message: string): string {
  if (message.includes('Could not find the function')) return 'Mettez à jour la base de données (migration des rôles).';
  return message;
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data, error } = await requireBackend().rpc('admin_stats');
  if (error) throw new Error(readable(error.message));
  return data as AdminStats;
}

export async function getMembers(search: string, page: number): Promise<{ members: Member[]; total: number }> {
  const { data, error } = await requireBackend().rpc('admin_members', { p_search: search.trim(), p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE });
  if (error) throw new Error(readable(error.message));
  const members = (data ?? []) as Member[];
  return { members, total: members[0]?.total ?? 0 };
}

export async function setMemberRole(userId: string, role: Role): Promise<void> {
  const { error } = await requireBackend().rpc('admin_set_role', { p_user: userId, p_role: role });
  if (error) throw new Error(readable(error.message));
}
