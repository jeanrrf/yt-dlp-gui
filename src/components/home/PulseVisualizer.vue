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
  const target = props.active ? props.state ?? fallbackState : idleState(time);

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
  const baseRadius = Math.min(widthPx, heightPx) * 0.25;
  const pulseRadius = baseRadius * (1 + displayState.energy * 0.12 + displayState.peak * 0.05);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, widthPx, heightPx);

  const backdrop = context.createRadialGradient(
    centerX,
    centerY,
    baseRadius * 0.15,
    centerX,
    centerY,
    widthPx * 0.65,
  );
  backdrop.addColorStop(0, "rgba(84, 58, 255, 0.24)");
  backdrop.addColorStop(0.45, "rgba(255, 56, 214, 0.18)");
  backdrop.addColorStop(1, "rgba(5, 5, 14, 0)");
  context.fillStyle = backdrop;
  context.fillRect(0, 0, widthPx, heightPx);

  context.save();
  context.translate(centerX, centerY);
  context.globalCompositeOperation = "lighter";

  const orbFill = context.createRadialGradient(
    -pulseRadius * 0.3,
    -pulseRadius * 0.35,
    pulseRadius * 0.2,
    0,
    0,
    pulseRadius * 1.25,
  );
  orbFill.addColorStop(0, "rgba(128, 214, 255, 0.92)");
  orbFill.addColorStop(0.32, "rgba(82, 88, 255, 0.54)");
  orbFill.addColorStop(0.7, "rgba(188, 56, 255, 0.24)");
  orbFill.addColorStop(1, "rgba(8, 4, 20, 0.05)");
  context.fillStyle = orbFill;
  context.beginPath();
  context.arc(0, 0, pulseRadius * 1, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = 1.2;
  for (let ring = 0; ring < 8; ring += 1) {
    const ratio = ring / 7;
    const rx = pulseRadius * (0.52 + ratio * 0.72);
    const ry = pulseRadius * (0.14 + ratio * 0.3);
    const yOffset = (ratio - 0.5) * pulseRadius * 1.08;
    context.strokeStyle =
      ring % 2 === 0 ? "rgba(98, 203, 255, 0.46)" : "rgba(255, 74, 224, 0.44)";
    context.beginPath();

    for (let step = 0; step <= 96; step += 1) {
      const angle = (step / 96) * Math.PI * 2;
      const wobble =
        1 +
        0.05 * displayState.bass * Math.sin(angle * 3 + time * 1.2 * motion + ring * 0.25) +
        0.03 * displayState.mids * Math.cos(angle * 5 - time * 1.1 * motion);
      const x = Math.cos(angle) * rx * wobble;
      const y = yOffset + Math.sin(angle) * ry * wobble;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }

    context.stroke();
  }

  for (let bar = 0; bar < 48; bar += 1) {
    const angle = (bar / 48) * Math.PI * 2 + time * 0.22 * motion;
    const lineX = Math.cos(angle);
    const lineY = Math.sin(angle);
    const energy = 0.28 + displayState.energy * 0.5 + (bar % 6) * 0.01;
    const inner = pulseRadius * 1.02;
    const outer = inner + 12 + energy * 42 + displayState.peak * 10;
    context.strokeStyle =
      bar % 2 === 0
        ? `rgba(76, 191, 255, ${0.25 + energy * 0.35})`
        : `rgba(255, 65, 225, ${0.2 + energy * 0.38})`;
    context.lineWidth = bar % 6 === 0 ? 2 : 1;
    context.beginPath();
    context.moveTo(lineX * inner, lineY * inner);
    context.lineTo(lineX * outer, lineY * outer);
    context.stroke();
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.12)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, pulseRadius * 1.05, 0, Math.PI * 2);
  context.stroke();

  for (let dot = 0; dot < 18; dot += 1) {
    const angle = (dot / 18) * Math.PI * 2 + time * (0.26 + dot * 0.005) * motion;
    const orbit = pulseRadius * (1.14 + (dot % 4) * 0.08);
    const x = Math.cos(angle) * orbit;
    const y = Math.sin(angle) * orbit;
    context.fillStyle = dot % 2 === 0 ? "rgba(88, 196, 255, 0.82)" : "rgba(255, 88, 228, 0.74)";
    context.beginPath();
    context.arc(x, y, dot % 3 === 0 ? 2.4 : 1.4, 0, Math.PI * 2);
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
    radial-gradient(circle at 24% 20%, rgba(61, 170, 255, 0.28), transparent 42%),
    radial-gradient(circle at 78% 74%, rgba(255, 50, 225, 0.26), transparent 38%),
    linear-gradient(155deg, rgba(7, 11, 28, 0.98), rgba(17, 8, 40, 0.94));
  border: 1px solid rgba(124, 212, 255, 0.16);
  box-shadow:
    0 28px 80px rgba(2, 6, 18, 0.52),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.pulse-shell::before {
  content: "";
  position: absolute;
  inset: 14px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
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
