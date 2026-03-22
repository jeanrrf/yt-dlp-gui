<script setup lang="ts">
interface PulseState {
  energy: number;
  bass: number;
  mids: number;
  highs: number;
  peak: number;
}

const props = withDefaults(
  defineProps<{
    state?: PulseState;
    active?: boolean;
  }>(),
  {
    active: false,
  },
);

const shellRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const { width, height } = useElementSize(shellRef);

const fallbackState: PulseState = {
  energy: 0.26,
  bass: 0.2,
  mids: 0.16,
  highs: 0.12,
  peak: 0.18,
};

const displayState = reactive<PulseState>({ ...fallbackState });

let frame = 0;
let prefersReducedMotion = false;
let mediaQuery: MediaQueryList | null = null;
let mediaQueryHandler: ((event: MediaQueryListEvent) => void) | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (current: number, target: number, amount: number) =>
  current + (target - current) * amount;

const syncCanvas = () => {
  if (!canvasRef.value) return;

  const cssWidth = Math.max(1, Math.round(width.value || 360));
  const cssHeight = Math.max(1, Math.round(height.value || cssWidth));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.round(cssWidth * dpr);
  const nextHeight = Math.round(cssHeight * dpr);

  if (canvasRef.value.width === nextWidth && canvasRef.value.height === nextHeight) return;

  canvasRef.value.width = nextWidth;
  canvasRef.value.height = nextHeight;
  canvasRef.value.style.width = `${cssWidth}px`;
  canvasRef.value.style.height = `${cssHeight}px`;
};

const idleState = (time: number): PulseState => ({
  energy: 0.26 + 0.03 * Math.sin(time * 1.8) + 0.02 * Math.cos(time * 2.4),
  bass: 0.2 + 0.02 * Math.sin(time * 1.5 + 0.4),
  mids: 0.16 + 0.02 * Math.cos(time * 2.1),
  highs: 0.12 + 0.02 * Math.sin(time * 3.3 + 0.8),
  peak: 0.18 + 0.02 * Math.sin(time * 4.6),
});

const updateState = (timestamp: number) => {
  const time = timestamp * 0.001;
  const target = props.active ? (props.state ?? fallbackState) : idleState(time);

  displayState.energy = lerp(displayState.energy, clamp(target.energy, 0.1, 1), 0.12);
  displayState.bass = lerp(displayState.bass, clamp(target.bass, 0.08, 1), 0.11);
  displayState.mids = lerp(displayState.mids, clamp(target.mids, 0.08, 1), 0.11);
  displayState.highs = lerp(displayState.highs, clamp(target.highs, 0.05, 1), 0.11);
  displayState.peak = Math.max(
    lerp(displayState.peak, clamp(target.peak, 0.08, 1), 0.13),
    displayState.peak * 0.94,
  );
};

const draw = (timestamp: number) => {
  if (!canvasRef.value) return;

  const context = canvasRef.value.getContext("2d");
  if (!context) return;

  syncCanvas();

  const widthPx = width.value || 360;
  const heightPx = height.value || widthPx;
  const time = timestamp * 0.001;
  const motion = prefersReducedMotion ? 0.35 : 1;
  const centerX = widthPx / 2;
  const centerY = heightPx / 2;
  const minSide = Math.min(widthPx, heightPx);
  const baseRadius = minSide * 0.26;
  const pulseRadius = baseRadius * (1 + displayState.energy * 0.1 + displayState.peak * 0.04);
  const orbX = centerX + Math.sin(time * 0.42) * 8 * motion;
  const orbY = centerY + Math.cos(time * 0.36) * 10 * motion;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, widthPx, heightPx);

  const backdrop = context.createRadialGradient(
    orbX,
    orbY,
    baseRadius * 0.2,
    centerX,
    centerY,
    widthPx * 0.82,
  );
  backdrop.addColorStop(0, "rgba(88, 214, 255, 0.22)");
  backdrop.addColorStop(0.38, "rgba(0, 198, 168, 0.14)");
  backdrop.addColorStop(0.72, "rgba(255, 166, 76, 0.12)");
  backdrop.addColorStop(1, "rgba(5, 9, 18, 0)");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, widthPx, heightPx);

  const halo = context.createRadialGradient(
    orbX,
    orbY,
    pulseRadius * 0.8,
    orbX,
    orbY,
    pulseRadius * (2.2 + displayState.energy * 0.6),
  );
  halo.addColorStop(0, `rgba(108, 229, 255, ${0.18 + displayState.energy * 0.1})`);
  halo.addColorStop(0.55, `rgba(0, 206, 184, ${0.12 + displayState.bass * 0.08})`);
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(orbX, orbY, pulseRadius * 2.35, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.translate(orbX, orbY);

  context.fillStyle = "rgba(0, 0, 0, 0.18)";
  context.beginPath();
  context.ellipse(0, pulseRadius * 1.28, pulseRadius * 0.92, pulseRadius * 0.22, 0, 0, Math.PI * 2);
  context.fill();

  context.globalCompositeOperation = "lighter";

  const outerShell = context.createRadialGradient(
    -pulseRadius * 0.36,
    -pulseRadius * 0.48,
    pulseRadius * 0.08,
    0,
    0,
    pulseRadius * 1.25,
  );
  outerShell.addColorStop(0, "rgba(244, 255, 255, 0.95)");
  outerShell.addColorStop(0.18, "rgba(127, 225, 255, 0.82)");
  outerShell.addColorStop(0.52, "rgba(18, 154, 196, 0.34)");
  outerShell.addColorStop(0.8, "rgba(10, 62, 92, 0.18)");
  outerShell.addColorStop(1, "rgba(4, 16, 24, 0.08)");
  context.fillStyle = outerShell;
  context.beginPath();
  context.arc(0, 0, pulseRadius, 0, Math.PI * 2);
  context.fill();

  const core = context.createRadialGradient(
    pulseRadius * 0.12,
    pulseRadius * 0.05,
    pulseRadius * 0.02,
    0,
    0,
    pulseRadius * 0.82,
  );
  core.addColorStop(0, `rgba(255, 245, 214, ${0.62 + displayState.peak * 0.12})`);
  core.addColorStop(0.36, `rgba(112, 255, 224, ${0.22 + displayState.mids * 0.18})`);
  core.addColorStop(0.72, "rgba(7, 98, 126, 0.08)");
  core.addColorStop(1, "rgba(7, 98, 126, 0)");
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, pulseRadius * 0.72, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(240, 252, 255, 0.34)";
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(0, 0, pulseRadius * 0.98, Math.PI * 0.14, Math.PI * 1.64);
  context.stroke();

  context.strokeStyle = `rgba(100, 240, 255, ${0.32 + displayState.highs * 0.24})`;
  context.lineWidth = 2.2;
  context.beginPath();
  context.arc(0, 0, pulseRadius * 0.78, Math.PI * 1.08, Math.PI * 1.92);
  context.stroke();

  for (let band = 0; band < 5; band += 1) {
    const ratio = band / 4;
    const radius = pulseRadius * (0.62 + ratio * 0.52);
    const arcStart = time * (0.18 + ratio * 0.07) + band * 0.6;
    const arcSize = Math.PI * (0.42 + displayState.energy * 0.12);
    context.strokeStyle =
      band % 2 === 0
        ? `rgba(88, 230, 255, ${0.16 + displayState.bass * 0.2})`
        : `rgba(255, 187, 98, ${0.12 + displayState.highs * 0.18})`;
    context.lineWidth = 1.2 + ratio * 1.2;
    context.beginPath();
    context.arc(0, 0, radius, arcStart, arcStart + arcSize);
    context.stroke();
  }

  for (let ray = 0; ray < 26; ray += 1) {
    const angle = (ray / 26) * Math.PI * 2 + time * 0.16 * motion;
    const base = pulseRadius * (0.92 + (ray % 3) * 0.03);
    const extension =
      10 +
      displayState.energy * 26 +
      displayState.peak * 18 +
      Math.sin(time * 1.8 + ray * 0.7) * 4 * motion;
    context.strokeStyle =
      ray % 4 === 0
        ? `rgba(255, 202, 116, ${0.12 + displayState.highs * 0.22})`
        : `rgba(96, 233, 255, ${0.1 + displayState.energy * 0.18})`;
    context.lineWidth = ray % 5 === 0 ? 2 : 1;
    context.beginPath();
    context.moveTo(Math.cos(angle) * base, Math.sin(angle) * base);
    context.lineTo(Math.cos(angle) * (base + extension), Math.sin(angle) * (base + extension));
    context.stroke();
  }

  for (let dot = 0; dot < 16; dot += 1) {
    const angle = (dot / 16) * Math.PI * 2 - time * (0.22 + dot * 0.006) * motion;
    const orbit = pulseRadius * (1.18 + (dot % 4) * 0.07);
    const x = Math.cos(angle) * orbit;
    const y = Math.sin(angle) * orbit;
    context.fillStyle =
      dot % 3 === 0 ? "rgba(255, 219, 142, 0.8)" : "rgba(127, 233, 255, 0.72)";
    context.beginPath();
    context.arc(x, y, dot % 5 === 0 ? 2.6 : 1.5, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
};

const animate = (timestamp: number) => {
  updateState(timestamp);
  draw(timestamp);
  frame = window.requestAnimationFrame(animate);
};

onMounted(() => {
  if (typeof window !== "undefined") {
    mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mediaQuery.matches;
    mediaQueryHandler = (event) => {
      prefersReducedMotion = event.matches;
    };
    mediaQuery.addEventListener("change", mediaQueryHandler);
  }

  syncCanvas();
  frame = window.requestAnimationFrame(animate);
});

watch([width, height], () => syncCanvas(), { flush: "post" });

onUnmounted(() => {
  if (frame) window.cancelAnimationFrame(frame);
  if (mediaQuery && mediaQueryHandler) {
    mediaQuery.removeEventListener("change", mediaQueryHandler);
  }
});
</script>

<template>
  <div ref="shellRef" class="pulse-shell">
    <canvas ref="canvasRef" class="pulse-canvas" />
  </div>
</template>

<style scoped lang="scss">
.pulse-shell {
  position: relative;
  width: min(100%, 420px);
  aspect-ratio: 1;
  border-radius: 32px;
  overflow: hidden;
  background:
    radial-gradient(circle at 20% 18%, rgba(114, 229, 255, 0.22), transparent 34%),
    radial-gradient(circle at 82% 76%, rgba(255, 186, 104, 0.16), transparent 30%),
    linear-gradient(160deg, rgba(5, 14, 24, 0.98), rgba(8, 24, 34, 0.94) 52%, rgba(19, 34, 28, 0.92));
  border: 1px solid rgba(133, 226, 240, 0.16);
  box-shadow:
    0 28px 80px rgba(2, 8, 16, 0.46),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -28px 48px rgba(0, 0, 0, 0.22);
}

.pulse-shell::before {
  content: "";
  position: absolute;
  inset: 14px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 24%),
    radial-gradient(circle at 70% 78%, rgba(0, 215, 176, 0.06), transparent 24%);
  pointer-events: none;
}

.pulse-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

@media (max-width: 720px) {
  .pulse-shell {
    width: min(100%, 360px);
  }
}
</style>
