/**
 * Cinematic Scroll-Based Frame Animation Engine
 * Ayush AI Sequence Viewer
 */

(function () {
  'use strict';

  // DOM Elements
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scrollTrack = document.getElementById('scroll-track');
  const scrollIndicator = document.getElementById('scroll-indicator');
  const scrubFill = document.getElementById('scrub-fill');
  
  // Preloader Elements
  const preloader = document.getElementById('preloader');
  const progressBar = document.getElementById('progress-bar');
  const progressPercent = document.getElementById('progress-percent');
  const frameCounter = document.getElementById('frame-counter');

  // Animation State
  const totalFrames = FRAME_PATHS.length;
  const loadedImages = new Array(totalFrames);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedIndex = -1;
  let isLoaded = false;
  let dpr = 1;

  // Configuration
  const LERP_FACTOR = 0.09; // Smooth inertial momentum
  const SOURCE_WIDTH = 1280;
  const SOURCE_HEIGHT = 720;

  /**
   * Adjust canvas for High DPI / Retina Displays
   * Ensures the canvas fills 100% of the viewport width and height
   */
  function setupCanvasDimensions() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    
    // Request instant redraw of current frame
    if (lastRenderedIndex >= 0) {
      renderFrame(lastRenderedIndex, true);
    }
  }

  /**
   * Draw an image frame with full viewport cover scaling
   * Guarantees the frame fills the entire height and width without black borders
   */
  function renderFrame(index, force = false) {
    if (!force && index === lastRenderedIndex) return;

    let img = loadedImages[index];
    
    // Graceful fallback to nearest available loaded frame if scrubbing fast
    if (!img || !img.complete || img.naturalWidth === 0) {
      img = findNearestLoadedImage(index);
    }

    if (!img) return;

    const cw = canvas.width;
    const ch = canvas.height;

    const imgW = img.naturalWidth || SOURCE_WIDTH;
    const imgH = img.naturalHeight || SOURCE_HEIGHT;

    // Full coverage: fills 100% of canvas width and 100% of canvas height
    const scale = Math.max(cw / imgW, ch / imgH);
    const drawW = Math.ceil(imgW * scale);
    const drawH = Math.ceil(imgH * scale);
    const drawX = Math.floor((cw - drawW) / 2);
    const drawY = Math.floor((ch - drawH) / 2);

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    lastRenderedIndex = index;
  }

  /**
   * Locate the nearest loaded frame when scrolling rapidly
   */
  function findNearestLoadedImage(targetIdx) {
    for (let offset = 0; offset < totalFrames; offset++) {
      const prev = targetIdx - offset;
      if (prev >= 0 && loadedImages[prev] && loadedImages[prev].complete && loadedImages[prev].naturalWidth > 0) {
        return loadedImages[prev];
      }
      const next = targetIdx + offset;
      if (next < totalFrames && loadedImages[next] && loadedImages[next].complete && loadedImages[next].naturalWidth > 0) {
        return loadedImages[next];
      }
    }
    return null;
  }

  /**
   * Update preloader UI as frames load
   */
  function handleImageProgress(index) {
    loadedCount++;
    const percent = Math.min(100, Math.round((loadedCount / totalFrames) * 100));

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (frameCounter) frameCounter.textContent = `${loadedCount} / ${totalFrames}`;

    // Render first frame immediately once available
    if (index === 0 && lastRenderedIndex === -1) {
      renderFrame(0, true);
    }

    // Dismiss preloader once all images are ready (or threshold reached)
    if (loadedCount >= totalFrames && !isLoaded) {
      isLoaded = true;
      completePreloader();
    }
  }

  /**
   * Fade out preloader gracefully
   */
  function completePreloader() {
    setTimeout(() => {
      preloader.classList.add('hidden');
      renderFrame(Math.round(currentProgress * (totalFrames - 1)), true);
    }, 250);
  }

  /**
   * Preload all frames in sequence/parallel
   */
  function preloadImages() {
    FRAME_PATHS.forEach((path, index) => {
      const img = new Image();
      img.decoding = 'async';
      
      img.onload = () => {
        loadedImages[index] = img;
        handleImageProgress(index);
      };

      img.onerror = () => {
        console.warn(`Failed to load frame at ${path}`);
        handleImageProgress(index);
      };

      img.src = path;
    });
  }

  /**
   * Calculate normalized scroll position
   */
  function onScroll() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollY = Math.max(0, window.scrollY);
    targetProgress = Math.max(0, Math.min(1, scrollY / maxScroll));

    // Hide scroll cue once user interacts
    if (scrollY > 30) {
      scrollIndicator.classList.add('faded');
    } else {
      scrollIndicator.classList.remove('faded');
    }
  }

  /**
   * Animation Render Loop (Lerped 60fps)
   */
  function animationLoop() {
    // Smooth linear interpolation (lerp)
    const diff = targetProgress - currentProgress;
    
    if (Math.abs(diff) > 0.0001) {
      currentProgress += diff * LERP_FACTOR;
    } else {
      currentProgress = targetProgress;
    }

    // Calculate frame index
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.round(currentProgress * (totalFrames - 1)))
    );

    renderFrame(frameIndex);

    // Update scrub bar
    if (scrubFill) {
      scrubFill.style.width = `${(currentProgress * 100).toFixed(2)}%`;
    }

    requestAnimationFrame(animationLoop);
  }

  /**
   * Initialize Experience
   */
  function init() {
    setupCanvasDimensions();
    preloadImages();
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      setupCanvasDimensions();
      onScroll();
    });
    window.addEventListener('orientationchange', () => {
      setupCanvasDimensions();
      onScroll();
    });
    window.addEventListener('load', onScroll);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        setupCanvasDimensions();
        onScroll();
      });
    }

    // Start 60fps render loop
    requestAnimationFrame(animationLoop);
  }

  // Kickstart once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
