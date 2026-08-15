// Technical probe for the current Premiere Pro UXP API surface.
// Keep this module conservative: it should observe and report capabilities before
// the panel starts mutating clips, effects, keyframes, or timeline audio.

const MODULE_NAME = 'premierepro';

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function listObjectKeys(value) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return [];

  const keys = new Set();
  let cursor = value;

  while (cursor && cursor !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(cursor)) {
      if (key !== 'constructor') keys.add(key);
    }
    cursor = Object.getPrototypeOf(cursor);
  }

  return Array.from(keys).sort();
}

function readScalar(value) {
  if (value === null || value === undefined) return value;
  if (['string', 'number', 'boolean'].includes(typeof value)) return value;

  if (typeof value === 'object') {
    if ('ticks' in value) return { ticks: value.ticks };
    if ('seconds' in value) return { seconds: value.seconds };
    if ('guid' in value) return { guid: value.guid };
  }

  return `[${valueType(value)}]`;
}

function summarizeObject(value) {
  const keys = listObjectKeys(value);
  const summary = {
    type: valueType(value),
    className: value?.constructor?.name || null,
    keys,
  };

  for (const key of ['name', 'guid', 'id', 'type', 'mediaType', 'start', 'end', 'inPoint', 'outPoint', 'duration']) {
    try {
      if (value && key in value) summary[key] = readScalar(value[key]);
    } catch (error) {
      summary[key] = `[read failed: ${error?.message || error}]`;
    }
  }

  return summary;
}

function summarizeSelection(selection) {
  const summary = summarizeObject(selection);

  for (const methodName of ['getTrackItems', 'getVideoTrackItems', 'getAudioTrackItems']) {
    summary[methodName] = {
      available: typeof selection?.[methodName] === 'function',
    };
  }

  for (const propertyName of ['trackItems', 'videoTrackItems', 'audioTrackItems', 'items']) {
    try {
      const value = selection?.[propertyName];
      if (Array.isArray(value)) {
        summary[propertyName] = {
          count: value.length,
          sample: value.slice(0, 5).map(summarizeObject),
        };
      }
    } catch (error) {
      summary[propertyName] = { error: error?.message || String(error) };
    }
  }

  return summary;
}

async function safeStep(report, name, fn) {
  const started = Date.now();

  try {
    const value = await fn();
    report.steps.push({
      name,
      ok: true,
      elapsedMs: Date.now() - started,
      summary: summarizeObject(value),
    });
    return value;
  } catch (error) {
    report.steps.push({
      name,
      ok: false,
      elapsedMs: Date.now() - started,
      errorName: error?.name || 'Error',
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || null,
    });
    return null;
  }
}

export async function probePremiereUxPApi() {
  const report = {
    version: '0.1.1',
    module: MODULE_NAME,
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      hasWindowRequire: typeof window.require === 'function',
      hasGlobalRequire: typeof globalThis.require === 'function',
      hasAdobeObject: typeof window.adobe !== 'undefined',
    },
    capabilities: {
      canRequirePremierePro: false,
      canGetActiveProject: false,
      canGetActiveSequence: false,
      canGetTimelineSelection: false,
      hasSequenceTrackCounts: false,
      hasUndoableTransactions: false,
    },
    steps: [],
  };

  const requireFn = typeof window.require === 'function'
    ? window.require
    : (typeof globalThis.require === 'function' ? globalThis.require : null);

  if (!requireFn) {
    report.steps.push({
      name: 'require.available',
      ok: false,
      errorMessage: 'No UXP/CommonJS require function is available in this host context.',
    });
    return report;
  }

  const ppro = await safeStep(report, 'require("premierepro")', () => requireFn(MODULE_NAME));
  report.capabilities.canRequirePremierePro = Boolean(ppro);
  if (!ppro) return report;

  report.premiereModule = summarizeObject(ppro);

  const activeProject = await safeStep(report, 'Project.getActiveProject()', async () => {
    if (!ppro.Project || typeof ppro.Project.getActiveProject !== 'function') {
      throw new Error('premierepro.Project.getActiveProject is not available.');
    }
    return ppro.Project.getActiveProject();
  });
  report.capabilities.canGetActiveProject = Boolean(activeProject);
  if (!activeProject) return report;

  report.capabilities.hasUndoableTransactions = typeof activeProject.executeTransaction === 'function';

  const activeSequence = await safeStep(report, 'project.getActiveSequence()', async () => {
    if (typeof activeProject.getActiveSequence !== 'function') {
      throw new Error('project.getActiveSequence is not available.');
    }
    return activeProject.getActiveSequence();
  });
  report.capabilities.canGetActiveSequence = Boolean(activeSequence);
  if (!activeSequence) return report;

  const trackCounts = await safeStep(report, 'sequence track counts', async () => {
    const counts = {};
    if (typeof activeSequence.getVideoTrackCount === 'function') {
      counts.video = await activeSequence.getVideoTrackCount();
    }
    if (typeof activeSequence.getAudioTrackCount === 'function') {
      counts.audio = await activeSequence.getAudioTrackCount();
    }
    return counts;
  });
  report.capabilities.hasSequenceTrackCounts = Boolean(trackCounts);
  report.trackCounts = trackCounts;

  const selection = await safeStep(report, 'sequence.getSelection()', async () => {
    if (typeof activeSequence.getSelection !== 'function') {
      throw new Error('sequence.getSelection is not available.');
    }
    return activeSequence.getSelection();
  });
  report.capabilities.canGetTimelineSelection = Boolean(selection);

  if (selection) {
    report.selection = summarizeSelection(selection);
  }

  return report;
}

export function interpretPremiereProbe(report) {
  if (!report.capabilities.canRequirePremierePro) {
    return {
      title: 'Premiere API indisponivel',
      meta: 'O painel carregou, mas require("premierepro") nao esta acessivel neste host/contexto.',
      status: 'Blocked',
    };
  }

  if (!report.capabilities.canGetActiveProject) {
    return {
      title: 'Projeto ativo nao lido',
      meta: 'A API UXP existe, mas o painel nao conseguiu obter o projeto ativo.',
      status: 'Project',
    };
  }

  if (!report.capabilities.canGetActiveSequence) {
    return {
      title: 'Sequencia ativa nao lida',
      meta: 'Abra uma sequencia no Premiere e rode Refresh novamente.',
      status: 'Sequence',
    };
  }

  if (!report.capabilities.canGetTimelineSelection) {
    return {
      title: 'Selecao da timeline nao lida',
      meta: 'A sequencia foi encontrada, mas getSelection falhou ou nao esta disponivel.',
      status: 'Selection',
    };
  }

  const video = report.trackCounts?.video;
  const audio = report.trackCounts?.audio;
  const trackMeta = video !== undefined || audio !== undefined
    ? `${video ?? '?'} video tracks, ${audio ?? '?'} audio tracks.`
    : 'Selecao lida; contagem de tracks nao confirmada.';

  return {
    title: 'API UXP conectada',
    meta: trackMeta,
    status: 'Ready',
  };
}
