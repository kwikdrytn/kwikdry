import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

/**
 * This component handles OAuth callbacks when the app is loaded in a popup window.
 * It detects if we're in an OAuth flow, extracts the code, and sends it back to the opener.
 */
export function OAuthCallbackHandler() {
  const [status, setStatus] = useState<'checking' | 'sending' | 'success' | 'error' | 'none'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // Check if this is an OAuth callback
    if (state === 'rc_oauth') {
      if (error) {
        setStatus('error');
        setMessage(errorDescription || 'Authorization was denied.');
        return;
      }

      if (code && window.opener) {
        setStatus('sending');
        setMessage('Completing connection...');

        // Send the code to the opener window
        window.opener.postMessage({
          type: 'rc_oauth_callback',
          code: code,
          state: state
        }, '*');

        setStatus('success');
        setMessage('Connected! This window will close automatically...');

        // Close the popup after a short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else if (code) {
        // No opener - might be a direct navigation, redirect to integrations page
        setStatus('sending');
        setMessage('Redirecting...');
        window.location.href = `/admin/settings/integrations?code=${code}&state=${state}`;
      }
    } else {
      setStatus('none');
    }
  }, []);

  // Don't render anything if this isn't an OAuth callback
  if (status === 'none' || status === 'checking') {
    return null;
  }

  // Render a full-screen overlay for the popup
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
      {status === 'sending' && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">{message}</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="h-10 w-10 text-primary mb-4" />
          <p className="text-primary font-medium">{message}</p>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle className="h-10 w-10 text-destructive mb-4" />
          <p className="text-destructive font-medium">{message}</p>
          <p className="text-muted-foreground text-sm mt-2">You can close this window.</p>
        </>
      )}
    </div>
  );
}
