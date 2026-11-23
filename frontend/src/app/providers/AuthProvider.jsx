import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient, supabaseConfig } from '../../lib/supabaseClient.js';
import { planService } from '../../services/planService.js';

const AuthContext = createContext(null);
const KNOWN_ROLES = new Set(['atleta', 'entrenador', 'administrador']);

function authErrorMessage(error) {
  if (error?.status === 401 || error?.code === 'invalid_credentials') return 'No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.';
  if (error?.status === 403) return 'El servidor no autorizó el acceso a esta sección.';
  if (error?.name === 'TypeError') return 'No se pudo conectar. Comprueba la conexión e inténtalo de nuevo.';
  return error?.message || 'No se pudo verificar la sesión. Inténtalo de nuevo.';
}

export function AuthProvider({ children }) {
  const clientRef = useRef(null);
  const [session, setSession] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [status, setStatus] = useState(supabaseConfig.configured ? 'loading' : 'unconfigured');
  const [error, setError] = useState('');

  const verifyIdentity = useCallback(async currentSession => {
    if (!currentSession?.access_token) {
      setSession(null);
      setIdentity(null);
      setStatus('signed-out');
      return null;
    }
    setSession(currentSession);
    setIdentity(null);
    setError('');
    setStatus('verifying');
    try {
      const result = await planService.getIdentity(currentSession.access_token);
      if (!KNOWN_ROLES.has(result?.rol)) {
        setStatus('unknown-role');
        setError('El servidor devolvió un rol desconocido. No se abrió ninguna interfaz protegida.');
        return null;
      }
      setIdentity(result);
      setStatus('authenticated');
      return result;
    } catch (caught) {
      if (caught?.status === 401) {
        setSession(null);
        setIdentity(null);
        setStatus('signed-out');
        setError('La sesión expiró. Inicia sesión de nuevo.');
      } else {
        setStatus('identity-error');
        setError(authErrorMessage(caught));
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfig.configured) return undefined;

    let active = true;
    let identityRequest = 0;
    let subscription;

    async function initialize() {
      try {
        const client = await getSupabaseClient();
        if (!active || !client) return;
        clientRef.current = client;
        planService.setAccessTokenProvider(async () => {
          const { data, error: sessionError } = await client.auth.getSession();
          if (sessionError) throw sessionError;
          return data.session?.access_token || null;
        });
        planService.setUnauthorizedHandler(() => client.auth.signOut());

        const applySession = nextSession => {
          const requestId = ++identityRequest;
          if (!nextSession) {
            setSession(null);
            setIdentity(null);
            setError('');
            setStatus('signed-out');
            return;
          }
          setSession(nextSession);
          setIdentity(null);
          setStatus('verifying');
          Promise.resolve().then(async () => {
            const result = await planService.getIdentity(nextSession.access_token);
            if (!active || requestId !== identityRequest) return;
            if (!KNOWN_ROLES.has(result?.rol)) {
              setStatus('unknown-role');
              setError('El servidor devolvió un rol desconocido. No se abrió ninguna interfaz protegida.');
              return;
            }
            setIdentity(result);
            setError('');
            setStatus('authenticated');
          }).catch(caught => {
            if (!active || requestId !== identityRequest) return;
            if (caught?.status === 401) {
              setSession(null);
              setIdentity(null);
              setStatus('signed-out');
              setError('La sesión expiró. Inicia sesión de nuevo.');
            } else {
              setStatus('identity-error');
              setError(authErrorMessage(caught));
            }
          });
        };

        const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => applySession(nextSession));
        subscription = authListener.subscription;
        const { data, error: sessionError } = await client.auth.getSession();
        if (!active) return;
        if (sessionError) {
          setStatus('identity-error');
          setError(authErrorMessage(sessionError));
          return;
        }
        applySession(data.session);
      } catch (caught) {
        if (!active) return;
        setStatus('identity-error');
        setError(authErrorMessage(caught));
      }
    }

    initialize();
    return () => {
      active = false;
      subscription?.unsubscribe();
      clientRef.current = null;
      planService.setAccessTokenProvider(null);
      planService.setUnauthorizedHandler(null);
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setError('');
    setStatus('authenticating');
    try {
      const client = clientRef.current || await getSupabaseClient();
      if (!client) throw new Error('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para habilitar el acceso real.');
      const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError || !data.session) {
        setStatus('signed-out');
        throw new Error(authErrorMessage(signInError || new Error('No se recibió una sesión.')));
      }
      const verifiedIdentity = await verifyIdentity(data.session);
      if (!verifiedIdentity) throw new Error('No fue posible verificar el rol de la cuenta con el servidor.');
      return verifiedIdentity;
    } catch (caught) {
      setStatus(current => current === 'identity-error' || current === 'unknown-role' ? current : 'signed-out');
      throw caught;
    }
  }, [verifyIdentity]);

  const retryIdentity = useCallback(async () => {
    try {
      const client = clientRef.current || await getSupabaseClient();
      if (!client) return null;
      const { data, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        setError(authErrorMessage(sessionError));
        setStatus('identity-error');
        return null;
      }
      return verifyIdentity(data.session);
    } catch (caught) {
      setError(authErrorMessage(caught));
      setStatus('identity-error');
      return null;
    }
  }, [verifyIdentity]);

  const signOut = useCallback(async () => {
    const client = clientRef.current;
    if (client) await client.auth.signOut();
    setSession(null);
    setIdentity(null);
    setError('');
    setStatus('signed-out');
  }, []);

  const value = useMemo(() => ({
    configured: supabaseConfig.configured,
    incomplete: supabaseConfig.incomplete,
    invalidUrl: supabaseConfig.invalidUrl,
    session,
    identity,
    role: identity?.rol || null,
    status,
    error,
    signIn,
    retryIdentity,
    signOut,
  }), [session, identity, status, error, signIn, retryIdentity, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}
