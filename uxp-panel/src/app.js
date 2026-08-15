import { DebugLogger, describeEnvironment } from './debug.js';
import { builtinPresets, applyPresetToSelectedClips } from './motionEngineBridge.js';
import { syncSelectedTimelineItems } from './audioSyncBridge.js';

const root = document;
const debug = new DebugLogger(root.getElementById('debugLog'));

const state = {
  activeTab: 'motion',
  motionPreset: builtinPresets[0],
  curve: {
    start: { x: 35, y: 145 },
    end: { x: 590, y: 82 },
    h1: { x: 145, y: 145 },
    h2: { x: 400, y: 82 },
  },
};

const curvePresets = {
  ease: [0.25, 0.10, 0.25, 1.00],
  'ease-in': [0.42, 0.00, 1.00, 1.00],
  'ease-out': [0.00, 0.00, 0.58, 1.00],
  quad: [0.45, 0.03, 0.52, 0.96],
  expo: [0.19, 1.00, 0.22, 1.00],
  back: [0.68, -0.55, 0.27, 1.55],
  circ: [0.79, 0.14, 0.15, 0.86],
  linear: [0.00, 0.00, 1.00, 1.00],
};

function $(selector) {
  return root.querySelector(selector);
}

function $all(selector) {
  return Array.from(root.querySelectorAll(selector));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setSelectionStatus(title, meta, status) {
  $('#selectionTitle').textContent = title;
  $('#selectionMeta').textContent = meta;
  $('#selectionState').textContent = status;
}

function setTab(tabName) {
  state.activeTab = tabName;

  $all('.tab').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === tabName);
  });

  $all('.tab-view').forEach((view) => {
    view.classList.toggle('is-visible', view.dataset.view === tabName);
  });

  debug.info('ui.tab.changed', { tabName });
}

function setMotionPreset(presetId) {
  const preset = builtinPresets.find((item) => item.id.includes(presetId)) || builtinPresets[0];
  state.motionPreset = preset;

  $all('[data-motion-preset]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.motionPreset === presetId);
  });

  debug.info('motion.preset.selected', { presetId, preset });
}

function curveToBezier() {
  const { start, end, h1, h2 } = state.curve;
  const xRange = end.x - start.x;
  const yTop = 20;
  const yRange = 145;

  return [
    (h1.x - start.x) / xRange,
    1 - ((h1.y - yTop) / yRange),
    (h2.x - start.x) / xRange,
    1 - ((h2.y - yTop) / yRange),
  ];
}

function setCurveFromBezier(values) {
  const [x1, y1, x2, y2] = values;
  const { start, end } = state.curve;
  const xRange = end.x - start.x;
  const yTop = 20;
  const yRange = 145;

  state.curve.h1.x = start.x + x1 * xRange;
  state.curve.h1.y = yTop + (1 - y1) * yRange;
  state.curve.h2.x = start.x + x2 * xRange;
  state.curve.h2.y = yTop + (1 - y2) * yRange;
  updateCurve();
}

function updateCurve() {
  const { start, end, h1, h2 } = state.curve;
  $('#curvePath').setAttribute('d', `M${start.x} ${start.y} C${h1.x} ${h1.y} ${h2.x} ${h2.y} ${end.x} ${end.y}`);
  $('#handleLineOne').setAttribute('d', `M${start.x} ${start.y} L${h1.x} ${h1.y}`);
  $('#handleLineTwo').setAttribute('d', `M${end.x} ${end.y} L${h2.x} ${h2.y}`);
  $('#handleOne').setAttribute('cx', h1.x);
  $('#handleOne').setAttribute('cy', h1.y);
  $('#handleTwo').setAttribute('cx', h2.x);
  $('#handleTwo').setAttribute('cy', h2.y);

  const bezier = curveToBezier().map((value) => value.toFixed(2));
  $('#curveValue').textContent = bezier.join(', ');
}

function enableHandleDrag(handleId, pointName) {
  const handle = root.getElementById(handleId);

  handle.addEventListener('pointerdown', (event) => {
    handle.setPointerCapture(event.pointerId);
    handle.style.cursor = 'grabbing';
  });

  handle.addEventListener('pointermove', (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) return;

    const svg = handle.ownerSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 620;
    const y = ((event.clientY - rect.top) / rect.height) * 190;

    state.curve[pointName].x = clamp(x, 35, 590);
    state.curve[pointName].y = clamp(y, 20, 165);
    updateCurve();
  });

  handle.addEventListener('pointerup', (event) => {
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
    handle.style.cursor = 'grab';
    debug.info('keyframes.curve.handle.changed', { pointName, bezier: curveToBezier() });
  });
}

async function tryAction(actionName, fn) {
  debug.info(`${actionName}.started`);

  try {
    const result = await fn();
    debug.info(`${actionName}.completed`, { result });
    return result;
  } catch (error) {
    debug.error(`${actionName}.failed`, error);
    return null;
  }
}

function wireEvents() {
  $all('.tab').forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  });

  $all('[data-motion-preset]').forEach((button) => {
    button.addEventListener('click', () => setMotionPreset(button.dataset.motionPreset));
  });

  $all('[data-curve]').forEach((button) => {
    button.addEventListener('click', () => {
      $all('[data-curve]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      setCurveFromBezier(curvePresets[button.dataset.curve]);
      debug.info('keyframes.curve.preset.selected', { preset: button.dataset.curve, bezier: curveToBezier() });
    });
  });

  $('#refreshSelection').addEventListener('click', () => {
    debug.apiMissing('selection.refresh', 'Premiere active timeline selection API');
    setSelectionStatus('Selecao ainda nao conectada', 'A API de selecao precisa ser validada no Premiere.', 'Debug');
  });

  $('#applyMotion').addEventListener('click', () => tryAction('motion.apply', async () => {
    return applyPresetToSelectedClips(state.motionPreset);
  }));

  $('#removeMotion').addEventListener('click', () => {
    debug.apiMissing('motion.remove', 'removeMotionEngineEffect');
  });

  $('#readKeys').addEventListener('click', () => {
    debug.apiMissing('keyframes.read', 'Premiere keyframe read API');
  });

  $('#reverseCurve').addEventListener('click', () => {
    const [x1, y1, x2, y2] = curveToBezier();
    setCurveFromBezier([1 - x2, 1 - y2, 1 - x1, 1 - y1]);
    debug.info('keyframes.curve.reversed', { bezier: curveToBezier() });
  });

  $('#favoriteCurve').addEventListener('click', () => {
    debug.info('keyframes.curve.favorite.placeholder', { bezier: curveToBezier() });
  });

  $('#applyCurve').addEventListener('click', () => {
    debug.apiMissing('keyframes.applyCurve', 'Premiere Bezier keyframe handle write API', { bezier: curveToBezier() });
  });

  $('#syncSelected').addEventListener('click', () => tryAction('audioSync.syncSelected', async () => {
    return syncSelectedTimelineItems({ dryRun: false });
  }));

  $('#copyDebug').addEventListener('click', () => tryAction('debug.copy', () => debug.copy()));
  $('#clearDebug').addEventListener('click', () => debug.clear());
}

function init() {
  wireEvents();
  enableHandleDrag('handleOne', 'h1');
  enableHandleDrag('handleTwo', 'h2');
  updateCurve();
  setMotionPreset('spring');
  debug.info('app.loaded', {
    version: '0.1.0',
    environment: describeEnvironment(),
  });
}

init();
