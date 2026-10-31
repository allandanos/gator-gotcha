export function shareUrl(scoreId: string): string {
  return `${window.location.origin}/s/${encodeURIComponent(scoreId)}`;
}

/** Open the Facebook share dialog for a score card. */
export function shareToFacebook(scoreId: string): void {
  const u = encodeURIComponent(shareUrl(scoreId));
  const popup = window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    'fb-share',
    'noopener,noreferrer,width=600,height=640',
  );
  // Popup blocked (common on mobile): navigate instead.
  if (!popup) window.location.href = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
}

/** Native share sheet where available (mobile); returns false if unsupported or dismissed. */
export async function shareNative(scoreId: string, score: number): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share({
      title: 'Gator Gotcha',
      text: `I scored ${score.toLocaleString()} in Gator Gotcha. Can you beat it?`,
      url: shareUrl(scoreId),
    });
    return true;
  } catch {
    return false;
  }
}
