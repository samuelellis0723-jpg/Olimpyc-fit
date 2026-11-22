import { supabase } from '../db/supabase.js';

export async function resolverActorDesdeToken(accessToken) {
  if (!accessToken) {
    const error = new Error('Token de autenticación ausente');
    error.code = 'NO_AUTENTICADO';
    throw error;
  }

  const { data: userData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !userData?.user?.id) {
    const error = new Error('Sesión o token inválido');
    error.code = 'NO_AUTENTICADO';
    throw error;
  }

  const authUserId = userData.user.id;

  const { data: miembro, error: miembroError } = await supabase
    .from('miembros')
    .select('id, gimnasio_id, rol')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (miembroError || !miembro) {
    const error = new Error('Membresía no encontrada para el usuario autenticado');
    error.code = 'MEMBRESIA_NO_ENCONTRADA';
    throw error;
  }

  return {
    usuarioId: miembro.id,
    gimnasioId: miembro.gimnasio_id,
    rol: miembro.rol,
  };
}

export async function tieneAsignacion({ gimnasioId, entrenadorId, atletaId }) {
  const { data, error } = await supabase
    .from('asignaciones')
    .select('id')
    .eq('gimnasio_id', gimnasioId)
    .eq('entrenador_id', entrenadorId)
    .eq('atleta_id', atletaId)
    .is('fecha_fin', null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}