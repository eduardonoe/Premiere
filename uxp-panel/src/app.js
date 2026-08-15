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

const curvePresetList = [
  { id: 'linear', label: 'linear', bezier: [0.00, 0.00, 1.00, 1.00] },
  { id: 'ease', label: 'ease', bezier: [0.25, 0.10, 0.25, 1.00] },
  { id: 'sine-in', label: 'sine in', bezier: [0.47, 0.00, 0.75, 0.72] },
  { id: 'sine-out', label: 'sine out', bezier: [0.39, 0.58, 0.57, 1.00] },
  { id: 'sine-in-out', label: 'sine i/o', bezier: [0.45, 0.05, 0.55, 0.95] },
  { id: 'quad-in', label: 'quad in', bezier: [0.55, 0.09, 0.68, 0.53] },
  { id: 'quad-out', label: 'quad out', bezier: [0.25, 0.46, 0.45, 0.94] },
  { id: 'quad-in-out', label: 'quad i/o', bezier: [0.46, 0.03, 0.52, 0.96] },
  { id: 'cubic-in', label: 'cubic in', bezier: [0.55, 0.06, 0.68, 0.19] },
  { id: 'cubic-out', label: 'cubic out', bezier: [0.22, 0.61, 0.36, 1.00] },
  { id: 'cubic-in-out', label: 'cubic i/o', bezier: [0.65, 0.05, 0.36, 1.00] },
  { id: 'quart-in', label: 'quart in', bezier: [0.90, 0.03, 0.69, 0.22] },
  { id: 'quart-out', label: 'quart out', bezier: [0.17, 0.84, 0.44, 1.00] },
  { id: 'quart-in-out', label: 'quart i/o', bezier: [0.77, 0.00, 0.18, 1.00] },
  { id: 'quint-in', label: 'quint in', bezier: [0.76, 0.05, 0.86, 0.06] },
  { id: 'quint-out', label: 'quint out', bezier: [0.23, 1.00, 0.32, 1.00] },
  { id: 'quint-in-out', label: 'quint i/o', bezier: [0.86, 0.00, 0.07, 1.00] },
  { id: 'expo-in', label: 'expo in', bezier: [0.95, 0.05, 0.80, 0.04] },
  { id: 'expo-out', label: 'expo out', bezier: [0.19, 1.00, 0.22, 1.00] },
  { id: 'expo-in-out', label: 'expo i/o', bezier: [1.00, 0.00, 0.00, 1.00] },
  { id: 'circ-in', label: 'circ in', bezier: [0.60, 0.04, 0.98, 0.34] },
  { id: 'circ-out', label: 'circ out', bezier: [0.08, 0.82, 0.17, 1.00] },
  { id: 'circ-in-out', label: 'circ i/o', bezier: [0.79, 0.14, 0.15, 0.86] },
  { id: 'back-in', label: 'back in', bezier: [0.60, -0.28, 0.74, 0.05] },
  { id: 'back-out', label: 'back out', bezier: [0.18, 0.89, 0.32, 1.28] },
  { id: 'back-in-out', label: 'back i/o', bezier: [0.68, -0.55, 0.27, 1.55] },
  { id: 'snap', label: 'snap', bezier: [0.17, 0.95, 0.28, 1.00] },
  { id: 'soft', label: 'soft', bezier: [0.33, 0.00, 0.20, 1.00] },
];

const curvePresets = Object.fromEntries(curvePresetList.map((preset) => [preset.id, preset.bezier]));

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

function miniCurvePath(values) {
  const [x1, y1, x2, y2] = values;
  const start = { x: 5, y: 23 };
  const end = { x: 35, y: 5 };
  const width = end.x - start.x;
  const height = start.y - end.y;
  const h1 = { x: start.x + x1 * width, y: start.y - y1 * height };
  const h2 = { x: start.x + x2 * width, y: start.y - y2 * height };
  return `M${start.x} ${start.y} C${h1.x.toFixed(2)} ${h1.y.toFixed(2)} ${h2.x.toFixed(2)} ${h2.y.toFixed(2)} ${end.x} ${end.y}`;
}

function renderCurveLibrary() {
  const library = $('#curveLibrary');
  library.textContent = '';

  curvePresetList.forEach((preset) => {
    const button = document.createElement('button');
    button.className = `curve-preset${preset.id === 'expo-out' ? ' is-active' : ''}`;
    button.type = 'button';
    button.dataset.curve = preset.id;
    button.title = `${preset.label}: ${preset.bezier.map((value) => value.toFixed(2)).join(', ')}`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 40 28');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', miniCurvePath(preset.bezier));
    svg.append(path);

    const label = document.createElement('span');
    label.textContent = preset.label;

    button.append(svg, label);
    library.append(button);
  });
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
    state.curve[pointName].y = clamp(y, -60, 245);
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

  $('#curveLibrary').addEventListener('click', (event) => {
    const button = event.target.closest('[data-curve]');
    if (!button) return;

    $all('[data-curve]').forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
    setCurveFromBezier(curvePresets[button.dataset.curve]);
    debug.info('keyframes.curve.preset.selected', { preset: button.dataset.curve, bezier: curveToBezier() });
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
  renderCurveLibrary();
  wireEvents();
  enableHandleDrag('handleOne', 'h1');
  enableHandleDrag('handleTwo', 'h2');
  setCurveFromBezier(curvePresets['expo-out']);
  setMotionPreset('spring');
  debug.info('app.loaded', {
    version: '0.1.0',
    environment: describeEnvironment(),
    curvePresetCount: curvePresetList.length,
  });
}

init();
