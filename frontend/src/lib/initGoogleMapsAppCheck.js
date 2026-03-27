/**
 * Opcional: liga o token do Firebase App Check ao Maps JavaScript API (Settings.fetchAppCheckToken),
 * exigido para alguns fluxos da Places API (nova) com restrição App Check.
 *
 * Ative com VITE_GOOGLE_MAPS_APP_CHECK=1 e preencha as variáveis Firebase + site key reCAPTCHA Enterprise.
 * @see https://developers.google.com/maps/documentation/javascript/places-app-check
 */

let configured = false;

export function isGoogleMapsAppCheckEnabled() {
  return String(import.meta.env.VITE_GOOGLE_MAPS_APP_CHECK || '').trim() === '1';
}

/**
 * Deve ser chamado depois que `window.google.maps` estiver disponível (ex.: após useJsApiLoader).
 * Sem efeito se App Check não estiver habilitado ou faltar configuração.
 */
export async function initGoogleMapsAppCheck() {
  if (!isGoogleMapsAppCheckEnabled() || configured) return;
  if (typeof window.google === 'undefined' || !window.google.maps?.importLibrary) {
    console.warn('[Maps App Check] google.maps.importLibrary indisponível; ignorando App Check.');
    return;
  }

  const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY || '').trim();
  const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim();
  const appId = (import.meta.env.VITE_FIREBASE_APP_ID || '').trim();
  const messagingSenderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();
  const siteKey = (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || '').trim();

  if (!apiKey || !projectId || !appId || !messagingSenderId || !siteKey) {
    console.warn('[Maps App Check] Configuração incompleta (Firebase/reCAPTCHA); ignorando.');
    return;
  }

  const authDomain =
    (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim() || `${projectId}.firebaseapp.com`;
  const storageBucket =
    (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim() || `${projectId}.appspot.com`;

  const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken }] = await Promise.all([
    import('firebase/app'),
    import('firebase/app-check'),
  ]);

  const app = initializeApp({
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  });

  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });

  const { Settings } = await window.google.maps.importLibrary('core');
  Settings.getInstance().fetchAppCheckToken = () => getToken(appCheck, false);

  configured = true;
}
