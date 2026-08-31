require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const logsDir = path.resolve(__dirname, 'logs');
const logFilePath = path.join(logsDir, 'service.log');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

const PORT = process.env.PORT || 3010;
const API_KEY = process.env.API_KEY || 'chiave_segreta_molto_sicura';
let browser;

function logDebug(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}`;
  console.log(logLine);
  try {
    logStream.write(`${logLine}\n`);
  } catch (err) {
    console.error(`[${timestamp}] [ERROR] Errore scrittura log su file: ${err.message}`);
  }
}

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    logDebug('Avvio di una nuova istanza di Puppeteer/Chromium...', 'DEBUG');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    logDebug('Istanza Puppeteer creata con successo.', 'DEBUG');
  }
  return browser;
}

app.post('/scrape', async (req, res) => {
  const startTime = Date.now();
  
  // 1. Controllo Autorizzazione
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    logDebug('Tentativo di accesso non autorizzato (API Key errata o mancante)', 'WARN');
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  // Predefinito su 'networkidle2' per attendere il rendering JS completo
  const { url, waitUntil = 'networkidle2' } = req.body;
  if (!url) {
    logDebug('Richiesta rifiutata: campo URL mancante nel payload', 'WARN');
    return res.status(400).json({ error: 'URL mancante' });
  }

  logDebug(`Richiesta ricevuta per URL: ${url} (waitUntil: ${waitUntil})`);

  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    
    // Imposta User-Agent reale per evitare blocchi anti-bot
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    
    // Dimensione viewport standard desktop
    await page.setViewport({ width: 1280, height: 800 });
    
    // Intercettazione e blocco solo di risorse multimediali pesanti
    await page.setRequestInterception(true);
    let blockedCount = 0;
    
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media'].includes(type)) {
        blockedCount++;
        req.abort();
      } else {
        req.continue();
      }
    });

    logDebug(`Navigazione verso ${url}...`, 'DEBUG');
    await page.goto(url, { waitUntil, timeout: 30000 });
    
    // Piccola attesa di sicurezza per il rendering di eventuali script tardivi
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));

    // Rimuove eventuali banner cookie visibili che nascondono il testo
    await page.evaluate(() => {
      const selectors = ['#cookie-banner', '.cookie-consent', '.modal-backdrop', '#iubenda-cs-banner'];
      selectors.forEach(s => {
        const el = document.querySelector(s);
        if (el) el.remove();
      });
    });

    const html = await page.content();
    const finalUrl = page.url();
    const duration = Date.now() - startTime;

    logDebug(`Scraping completato per ${url} in ${duration}ms (Risorse bloccate: ${blockedCount}, HTML: ${html.length} chars)`);

    return res.json({ html, finalUrl });
  } catch (err) {
    const duration = Date.now() - startTime;
    logDebug(`Errore durante lo scraping di ${url} dopo ${duration}ms: ${err.message}`, 'ERROR');
    return res.status(500).json({ error: err.message });
  } finally {
    if (page) {
      await page.close().catch((e) => logDebug(`Errore durante la chiusura della pagina: ${e.message}`, 'WARN'));
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  logDebug(`Servizio Remote Puppeteer avviato in ascolto sulla porta ${PORT}`);
  logDebug(`API Key configurata: ${API_KEY ? 'Sì (Nascosta)' : 'No (Usando valore di default)'}`);
});
