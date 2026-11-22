import { supabaseAdmin } from '../../db/supabase.js';

export async function verificarConexionDemo() {
  const { data, error } = await supabaseAdmin
    .from('miembros')
    .select('codigo_demo, rol, nombre')
    .order('codigo_demo', { ascending: true });

  if (error) throw error;
  return data;
}