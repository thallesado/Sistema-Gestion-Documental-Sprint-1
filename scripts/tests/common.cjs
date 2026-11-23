const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function getPlaywright() {
  try {
    return require('playwright');
  } catch {
    const links = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', '.links');
    if (fs.existsSync(links)) {
      for (const name of fs.readdirSync(links)) {
        try {
          const target = fs.readFileSync(path.join(links, name), 'utf8').trim();
          return require(target);
        } catch {}
      }
    }
  }
  throw new Error('Playwright no está instalado o no se encuentra en el entorno.');
}

async function launchBrowser(options = {}) {
  const pw = getPlaywright();
  const headless = options.headless !== undefined ? options.headless : true;
  const launchOptions = {
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };

  // Buscar executablePath existente si el headless shell por defecto tiene diferencia de versión
  const defaultChrome = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1254', 'chrome-win64', 'chrome.exe');
  if (fs.existsSync(defaultChrome)) {
    launchOptions.executablePath = defaultChrome;
  } else {
    // Buscar Edge si está disponible
    const edgePaths = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const ep of edgePaths) {
      if (fs.existsSync(ep)) {
        launchOptions.executablePath = ep;
        break;
      }
    }
  }

  return await pw.chromium.launch(launchOptions);
}

async function createContext(browser, options = {}) {
  const viewport = options.viewport || { width: 1440, height: 900 };
  const context = await browser.newContext({
    viewport,
    locale: 'es-BO',
    timezoneId: 'America/La_Paz'
  });
  return context;
}

module.exports = {
  getPlaywright,
  launchBrowser,
  createContext
};
