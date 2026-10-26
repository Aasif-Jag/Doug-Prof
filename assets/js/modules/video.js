export function initVideo() {
  document.querySelectorAll('video[autoplay]').forEach((v) => {
    // Seek back 0.5s before the end so the browser never hits the actual
    // last frame — avoids the black flash Safari shows when loop + preload=none
    // causes the start of the file to fall out of the buffer.
    v.addEventListener('timeupdate', () => {
      if (v.duration && v.currentTime >= v.duration - 0.5) {
        v.currentTime = 0;
      }
    });
  });
}
