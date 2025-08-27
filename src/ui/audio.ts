/**
 * Minimal audio helper for UI sound effects
 * Keeps audio decoupled and safe to no-op if AudioContext cannot start
 */

let audioContext: AudioContext | null = null;

/**
 * Initialize audio context on first interaction (required for autoplay policies)
 */
function getAudioContext(): AudioContext | null {
  if (audioContext !== null) return audioContext;

  try {
    audioContext = new AudioContext();
    return audioContext;
  } catch (error: unknown) {
    console.warn("AudioContext not available:", error);
    return null;
  }
}

/**
 * Play a short "boop" sound using WebAudio oscillator
 * Safe to call - will no-op if audio is not available
 */
export function playBoop(): void {
  const ctx = getAudioContext();
  if (ctx === null) return;

  try {
    // Resume context if suspended (required after autoplay policy changes)
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        // Ignore resume errors - audio just won't play
      });
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Short, pleasant boop sound
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      400,
      ctx.currentTime + 0.1,
    );

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  } catch (error: unknown) {
    // Silently ignore audio errors - not critical functionality
    console.warn("Audio playback failed:", error);
  }
}
