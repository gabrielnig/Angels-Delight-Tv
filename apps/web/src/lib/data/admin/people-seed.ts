import type { AuditRow, InviteRecord, StaffRecord, UserRecord } from './types';

const ago = (now: number, days: number) => new Date(now - days * 86_400_000).toISOString();

export function seedPeople(now: number): {
  users: UserRecord[];
  staff: StaffRecord[];
  invites: InviteRecord[];
  audit: AuditRow[];
} {
  const names = [
    'Adaeze',
    'Tunde',
    'Zainab',
    'Emeka',
    'Folake',
    'Ibrahim',
    'Chidi',
    'Amaka',
    'Seun',
    'Halima',
    'Kelechi',
    'Yetunde',
  ];
  const users: UserRecord[] = names.map((name, i) => ({
    id: `usr_${i + 1}`,
    email: `${name.toLowerCase()}@example.test`,
    status: i === 5 ? 'suspended' : 'active',
    createdAt: ago(now, 120 - i * 7),
    lastActiveAt: i === 9 ? null : ago(now, i % 6),
    profiles: [
      { id: `pro_${i}a`, name, kids: false },
      ...(i % 3 === 0 ? [{ id: `pro_${i}b`, name: `${name} Jr`, kids: true }] : []),
    ],
    sessions: i === 5 || i === 9 ? 0 : 1 + (i % 3),
    suspendedReason: i === 5 ? 'Shared the account for payment' : null,
  }));
  const staff: StaffRecord[] = [
    {
      id: 'acc_arkdev',
      name: 'Arkdev',
      email: 'arkdev@example.test',
      role: 'super_admin',
      twoFactor: true,
      lastSignInAt: ago(now, 0),
    },
    {
      id: 'stf_1',
      name: 'Chiamaka',
      email: 'chiamaka@example.test',
      role: 'admin',
      twoFactor: true,
      lastSignInAt: ago(now, 0),
    },
    {
      id: 'stf_2',
      name: 'Ngozi',
      email: 'ngozi@example.test',
      role: 'editor',
      twoFactor: true,
      lastSignInAt: ago(now, 2),
    },
    {
      id: 'stf_3',
      name: 'Tobi',
      email: 'tobi@example.test',
      role: 'editor',
      twoFactor: false,
      lastSignInAt: null,
    },
  ];
  const invites: InviteRecord[] = [
    {
      id: 'inv_1',
      email: 'sade@example.test',
      role: 'editor',
      invitedBy: 'Chiamaka',
      createdAt: ago(now, 2),
      expiresAt: new Date(now + 5 * 86_400_000).toISOString(),
    },
    {
      id: 'inv_2',
      email: 'old@example.test',
      role: 'editor',
      invitedBy: 'Chiamaka',
      createdAt: ago(now, 12),
      expiresAt: ago(now, 5),
    },
  ];
  const audit: AuditRow[] = [
    {
      id: 3,
      at: ago(now, 0.1),
      actorId: 'stf_2',
      actorName: 'Ngozi',
      actorRole: 'editor',
      action: 'video.publish',
      outcome: 'success',
      targetType: 'video',
      targetId: 'vid_1',
      summary: 'Published a video',
      before: { publishState: 'draft' },
      after: { publishState: 'published' },
      ip: '102.89.x.x',
      requestId: 'req_3',
    },
    {
      id: 2,
      at: ago(now, 1),
      actorId: 'stf_1',
      actorName: 'Chiamaka',
      actorRole: 'admin',
      action: 'staff.invite',
      outcome: 'success',
      targetType: 'invite',
      targetId: 'inv_1',
      summary: 'Invited sade@example.test as editor',
      before: null,
      after: { email: 'sade@example.test', role: 'editor' },
      ip: '102.89.x.x',
      requestId: 'req_2',
    },
    {
      id: 1,
      at: ago(now, 2),
      actorId: null,
      actorName: 'Unknown',
      actorRole: null,
      action: 'auth.login_failed',
      outcome: 'failure',
      targetType: null,
      targetId: null,
      summary: 'Wrong password for an admin account',
      before: null,
      after: null,
      ip: '41.58.x.x',
      requestId: 'req_1',
    },
  ];
  return { users, staff, invites, audit };
}
