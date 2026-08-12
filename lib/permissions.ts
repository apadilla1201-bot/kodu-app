// ============================================================
// PASO 3 — Matriz de permisos por rol (definida por el cliente)
// ------------------------------------------------------------
// admin / pm        → acceso total (ver, crear, editar todo)
// superintendent    → todo EXCEPTO Pay Applications y Budgets (ni verlos)
// owner             → solo SU proyecto; solo VER (rfis, cors, pay-apps, photos)
// subcontractor     → solo lo asignado a él (alcance por ítem, como hoy)
// viewer (legacy)   → solo lectura general
// architect         → NO tiene cuenta: responde por enlace seguro (magic link)
// ============================================================

export type AppRole =
  | 'admin'
  | 'owner' // legacy: dueño de la empresa (tenant) = admin
  | 'pm'
  | 'superintendent'
  | 'subcontractor'
  | 'estimator' // legacy
  | 'viewer'
  | string;

// Roles con acceso total
export function isFullAccess(role: AppRole): boolean {
  return role === 'admin' || role === 'owner' || role === 'pm';
}

// Puede ver el módulo Pay Applications
export function canViewPayApps(role: AppRole): boolean {
  return isFullAccess(role);
}

// Puede ver el módulo Budgets
export function canViewBudgets(role: AppRole): boolean {
  return isFullAccess(role);
}

// Puede crear/editar/eliminar (cualquier módulo que vea)
export function canWrite(role: AppRole): boolean {
  return isFullAccess(role) || role === 'superintendent' || role === 'estimator';
}

// Puede invitar miembros al equipo
export function canInvite(role: AppRole): boolean {
  return role === 'admin' || role === 'owner' || role === 'pm';
}

// Solo lectura (owner del proyecto, viewer)
export function isReadOnly(role: AppRole): boolean {
  return role === 'viewer' || role === 'subcontractor';
}

// ¿El rol tiene alcance por proyecto? (solo ve proyectos donde es miembro)
export function hasProjectScope(role: AppRole): boolean {
  return role === 'subcontractor';
}

// Rol "owner" (propietario del proyecto): ve solo su proyecto, solo lectura.
// OJO: 'owner' como rol de USUARIO legacy significa dueño de la empresa (acceso total).
// Para el rol de membresía "owner del proyecto" usamos projectRole === 'owner'.
export function isProjectOwnerRestricted(memberRole: AppRole): boolean {
  return memberRole === 'owner';
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  pm: 'Project Manager',
  superintendent: 'Superintendent',
  owner: 'Owner (view only)',
  subcontractor: 'Subcontractor',
  estimator: 'Estimator',
  viewer: 'Viewer',
};

// Qué ítems del menú ve cada rol (href del dashboard)
const NAV_BY_ROLE: Record<string, string[]> = {
  full: [
    '/dashboard', '/dashboard/projects', '/dashboard/rfis', '/dashboard/submittals',
    '/dashboard/buyout', '/dashboard/pay-apps', '/dashboard/lien-waivers', '/dashboard/sub-invoices', '/dashboard/punch-list', '/dashboard/closeout', '/dashboard/plans', '/dashboard/budgets', '/dashboard/photos',
    '/dashboard/settings', '/dashboard/team',
    '/dashboard/help',
  ],
  superintendent: [
    '/dashboard', '/dashboard/projects', '/dashboard/rfis', '/dashboard/submittals',
    '/dashboard/buyout', '/dashboard/photos',
    '/dashboard/settings', '/dashboard/help', '/dashboard/punch-list', '/dashboard/closeout', '/dashboard/plans',
    // SIN /dashboard/pay-apps ni /dashboard/budgets (punch-list SÍ: es su trabajo de campo)
  ],
  projectViewer: [
    // owner del proyecto / viewer: solo lectura de su proyecto
    '/dashboard', '/dashboard/projects', '/dashboard/rfis', '/dashboard/submittals',
    '/dashboard/photos', '/dashboard/settings', '/dashboard/help',
  ],
  subcontractor: [
    '/dashboard', '/dashboard/rfis', '/dashboard/submittals', '/dashboard/settings',
    '/dashboard/help',
  ],
};

export function navForRole(role: AppRole): string[] {
  if (isFullAccess(role)) return NAV_BY_ROLE.full;
  if (role === 'superintendent') return NAV_BY_ROLE.superintendent;
  if (role === 'subcontractor') return NAV_BY_ROLE.subcontractor;
  // Fallback seguro: cualquier rol desconocido/legacy ('user', '', null…)
  // ve el menú COMPLETO. Los módulos sensibles (Budgets, Pay Apps, Approvals,
  // Team) tienen su propia guarda en el servidor (redirect si no es gestión).
  // Antes: un rol legacy como 'user' caía en "viewer" y veía solo el
  // Dashboard — fue el bug reportado el 2026-08-02 con la cuenta PDG.
  return NAV_BY_ROLE.full;
}

// ¿Puede acceder a una ruta del dashboard? (para middleware/guards)
export function canAccessPath(role: AppRole, path: string): boolean {
  const allowed = navForRole(role);
  return allowed.some((p) => path === p || path.startsWith(p + '/'));
}
