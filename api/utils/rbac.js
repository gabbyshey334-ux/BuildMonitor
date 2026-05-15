/**
 * Role-based access: owner, manager, linked profile.
 * Uses service-role Supabase client — enforce in every route before writes.
 */

export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  LINKED: 'linked',
  NONE: 'none',
};

/**
 * Resolve role including linked WhatsApp profiles.
 * @param {string[]} linkedUserIds from getLinkedUserIdsForAuth
 */
export function roleFromProjectRow(projectRow, userId, linkedUserIds = []) {
  if (!projectRow) return ROLES.NONE;
  if (linkedUserIds.includes(projectRow.user_id)) return ROLES.OWNER;
  if (projectRow.user_id === userId) return ROLES.OWNER;
  if (projectRow.manager_id === userId) return ROLES.MANAGER;
  return ROLES.NONE;
}

/** Owners and managers may write project data; viewers are read-only (future). */
export function canWriteProject(role) {
  return role === ROLES.OWNER || role === ROLES.MANAGER;
}

export function canReadProject(role) {
  return role !== ROLES.NONE;
}
