/**
 * Flags de administrador no User podem vir como boolean OU string (legado / dados importados).
 * Em JS, a string 'false' é truthy — nunca use `if (user.isAdmin)` sem normalizar.
 */

export function isAdminUserDoc(u) {
  if (!u) return false;
  const role = String(u.role ?? '').trim().toLowerCase();
  if (role === 'admin') return true;
  const v = u.isAdmin;
  if (v === true || v === 1) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

/**
 * Padrões que identificam conta admin no Mongo (para $nor em listagens de médicos).
 */
export const MONGO_NOR_ADMIN_USER = [
  { role: 'admin' },
  { role: 'Admin' },
  { isAdmin: true },
  { isAdmin: 'true' },
  { isAdmin: 1 }
];

/** Filtro: usuários que NÃO são administradores (médicos na plataforma) */
export function filterUsersWhoAreNotAdmins() {
  return { $nor: MONGO_NOR_ADMIN_USER };
}

/** Filtro: usuários administradores */
export function filterUsersWhoAreAdmins() {
  return {
    $or: [
      { role: 'admin' },
      { role: 'Admin' },
      { isAdmin: true },
      { isAdmin: 'true' },
      { isAdmin: 1 }
    ]
  };
}
