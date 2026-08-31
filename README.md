# Remote Puppeteer Service

Un piccolo servizio HTTP basato su Express e Puppeteer che effettua lo scraping di pagine web renderizzate (JS incluso) e ne restituisce l'HTML finale.

## Caratteristiche

- Avvia un'istanza headless di Chromium tramite Puppeteer (riutilizzata tra le richieste).
- Autenticazione tramite API Key (header `Authorization: Bearer <API_KEY>`).
- Blocco delle risorse pesanti (immagini, media) per velocizzare il caricamento.
- User-Agent desktop realistico per ridurre i blocchi anti-bot.
- Rimozione automatica di banner cookie/modali comuni.
- Attesa configurabile del rendering pagina (`waitUntil`).

## Requisiti

- Node.js 18+
- npm

## Installazione

```bash
npm install
```

## Configurazione

Crea un file `.env` nella root del progetto (opzionale, esistono valori di default):

```env
PORT=3010
API_KEY=chiave_segreta_molto_sicura
```

> ⚠️ In produzione imposta sempre una `API_KEY` robusta e non usare il valore di default.

## Avvio

```bash
node server.js
```

Il servizio si mette in ascolto su `http://0.0.0.0:PORT` (default `3010`).

## Utilizzo

### `POST /scrape`

Effettua lo scraping di una URL e restituisce l'HTML renderizzato.

**Header richiesti:**

| Header          | Valore                     |
|-----------------|----------------------------|
| `Content-Type`  | `application/json`         |
| `Authorization` | `Bearer <API_KEY>`         |

**Body (JSON):**

| Campo       | Tipo   | Obbligatorio | Default          | Descrizione                                                                 |
|-------------|--------|--------------|------------------|------------------------------------------------------------------------------|
| `url`       | string | Sì           | -                | URL della pagina da scaricare                                               |
| `waitUntil` | string | No           | `networkidle2`   | Strategia di attesa Puppeteer (`load`, `domcontentloaded`, `networkidle0`, `networkidle2`) |

**Esempio richiesta:**

```bash
curl -X POST http://localhost:3010/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer chiave_segreta_molto_sicura" \
  -d '{"url": "https://example.com"}'
```

**Risposta (200):**

```json
{
  "html": "<!doctype html>...",
  "finalUrl": "https://example.com/"
}
```

**Errori:**

| Status | Descrizione                              |
|--------|-------------------------------------------|
| 400    | Campo `url` mancante nel body             |
| 401    | API Key mancante o errata                 |
| 500    | Errore durante la navigazione/scraping    |

## Note

- Puppeteer viene avviato con `--no-sandbox` e flag correlate: adatto per esecuzione in container/ambienti CI, ma valuta le implicazioni di sicurezza nel tuo contesto di deploy.
- Il timeout di navigazione è impostato a 30 secondi.
