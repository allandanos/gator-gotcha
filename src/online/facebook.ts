import { ensureSession, supabase } from './client';

/** Facebook Login stays hidden until a Meta app is configured (VITE_FB_LOGIN_ENABLED=true). */
export const isFacebookEnabled = (): boolean => import.meta.env.VITE_FB_LOGIN_ENABLED === 'true';

/**
 * Link Facebook to the current (anonymous) account so the player keeps their scores and can sign
 * in on other devices. Redirects to Facebook and back.
 */
export async function linkFacebook(): Promise<void> {
  await ensureSession();
  const { error } = await supabase().auth.linkIdentity({
    provider: 'facebook',
    options: { redirectTo: window.location.href },
  });
  if (error) throw new Error(error.message);
}
