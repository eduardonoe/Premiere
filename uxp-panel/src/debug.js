const MAX_ENTRIES = 250;

export class DebugLogger {
  constructor(outputElement) {
    this.outputElement = outputElement;
    this.entries = [];
  }

  info(action, details = {}) {
    this.write('info', action, details);
  }

  warn(action, details = {}) {
    this.write('warn', action, details);
  }

  error(action, error, details = {}) {
    this.write('error', action, {
      ...details,
      errorName: error?.name || 'Error',
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || null,
    });
  }

  apiMissing(action, apiName, details = {}) {
    this.write('api-missing', action, {
      ...details,
      apiName,
      hint: 'This action needs to be wired to the current Premiere UXP API or native engine.',
    });
  }

  write(level, action, details = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      action,
      details,
    };

    this.entries.unshift(entry);
    this.entries = this.entries.slice(0, MAX_ENTRIES);
    this.render();
  }

  clear() {
    this.entries = [];
    this.render();
  }

  text() {
    return this.entries.map((entry) => JSON.stringify(entry, null, 2)).join('\n');
  }

  async copy() {
    const text = this.text();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        this.info('debug.copy', { method: 'navigator.clipboard' });
        return true;
      }
    } catch (error) {
      this.error('debug.copy.failed', error);
    }

    return false;
  }

  render() {
    if (!this.outputElement) return;
    this.outputElement.textContent = this.text();
  }
}

export function describeEnvironment() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    hasClipboard: Boolean(navigator?.clipboard?.writeText),
    hasAdobeObject: typeof window.adobe !== 'undefined',
    hasPremiereRequire: typeof window.require === 'function',
  };
}
