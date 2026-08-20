/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const crypto = require("node:crypto");
const path = require("node:path");
const fs = require("node:fs");
const { spawn, spawnSync } = require("node:child_process");

const HOST = "0.0.0.0";
const PORT = Number(process.env.CAZAPIEZAS_PRINT_PORT || 8765);
const DRY_RUN = process.env.CAZAPIEZAS_PRINT_DRY_RUN === "1";
// Una estantería puede incluir decenas de QR en un único documento. El puente
// solo escucha en la red privada y sanea el HTML antes de imprimir, por lo que
// admitimos lotes grandes sin abrir la puerta a trabajos ilimitados.
const MAX_BODY_BYTES = 5_000_000;
const jobs = new Map();
const PRINTER_QUEUES = {
  "62x32": "Brother QL-570 - Corte 32 mm",
  "62x42": "Brother QL-570 - Corte 42 mm",
  "62x100": "Brother QL-570 - Corte 100 mm",
};

function isPrivateAddress(address = "") {
  const ip = address.replace(/^::ffff:/, "");
  if (ip === "::1" || ip === "127.0.0.1") return true;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip)) return true;
  const match = ip.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function sanitizeLabelHtml(html) {
  if (typeof html !== "string" || html.length < 50 || html.length > MAX_BODY_BYTES) {
    throw new Error("La etiqueta recibida no tiene un tamaño válido.");
  }
  if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
    throw new Error("La etiqueta recibida no es un documento HTML válido.");
  }

  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*>[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, "")
    .replace(/<(?:iframe|object|embed)\b[^>]*\/?\s*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function printableDocument(html) {
  const safeHtml = sanitizeLabelHtml(html);
  const printScript = `<script>
window.addEventListener("load", async () => {
  const images = Array.from(document.images);
  await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  })));
  if (document.fonts?.ready) await document.fonts.ready;
  for (const name of document.querySelectorAll("[data-fit-name]")) {
    const box = name.parentElement;
    let fontSize = Number(name.getAttribute("data-max-font")) || 42;
    name.style.fontSize = fontSize + "pt";
    while (fontSize > 2 && (name.scrollHeight > box.clientHeight || name.scrollWidth > box.clientWidth)) {
      fontSize -= 0.25;
      name.style.fontSize = fontSize + "pt";
    }
  }
  setTimeout(() => window.print(), 250);
});
window.addEventListener("afterprint", () => setTimeout(() => window.close(), 250));
</script>`;

  return /<\/body\s*>/i.test(safeHtml)
    ? safeHtml.replace(/<\/body\s*>/i, `${printScript}</body>`)
    : `${safeHtml}${printScript}`;
}

function detectPaperFormat(html) {
  const pageSize = html.match(/@page\s*\{[^}]*\bsize\s*:\s*62mm\s+(30|32|42)mm\b/i)?.[1];
  if (pageSize === "42") return "62x42";
  if (pageSize === "30" || pageSize === "32") return "62x32";
  if (/@page\s*\{[^}]*\bsize\s*:\s*100mm\s+62mm\b/i.test(html)) return "62x100";
  throw new Error("La etiqueta no indica un tamaño compatible (62 × 32, 62 × 42 o 62 × 100 mm).");
}

function bridgePage() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Imprimir en Brother QL-570</title><style>
*{box-sizing:border-box}body{margin:0;background:#09090b;color:#fafafa;font-family:Arial,sans-serif}.wrap{width:min(680px,100%);margin:auto;padding:18px}.card{overflow:hidden;border:1px solid #3f3f46;border-radius:22px;background:#18181b;box-shadow:0 18px 50px #0008}header{padding:20px;border-bottom:1px solid #3f3f46}h1{margin:0;font-size:22px}p{color:#a1a1aa;line-height:1.45}.status{margin:14px 0;padding:12px;border-radius:12px;background:#27272a}.preview{display:flex;justify-content:center;min-height:190px;padding:18px;background:#27272a}.preview iframe{width:100%;height:220px;border:0;border-radius:10px;background:#fff}.actions{padding:18px}.print{width:100%;border:0;border-radius:14px;padding:15px;background:#22d3ee;color:#09090b;font-size:17px;font-weight:900}.print:disabled{opacity:.45}.error{color:#fca5a5}.ok{color:#86efac}</style></head><body><main class="wrap"><section class="card"><header><h1>Brother QL-570</h1><p>Comprueba la etiqueta y confirma el envío al PC.</p></header><div class="preview"><iframe id="preview" title="Vista previa" sandbox="allow-scripts"></iframe></div><div class="actions"><div id="status" class="status">Preparando la etiqueta…</div><button id="print" class="print" disabled>Imprimir ahora</button></div></section></main><script>
const statusBox=document.getElementById("status");const printButton=document.getElementById("print");let labelHtml="";
function decodeJob(){const params=new URLSearchParams(location.hash.slice(1));const encoded=params.get("job");if(!encoded)throw new Error("No se ha recibido ninguna etiqueta.");const base64=encoded.replace(/-/g,"+").replace(/_/g,"/");const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
function previewDocument(html){const clean=html.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script\\s*>/gi,"").replace(/<(?:iframe|object|embed)\\b[^>]*>[\\s\\S]*?<\\/(?:iframe|object|embed)\\s*>/gi,"").replace(/\\son[a-z]+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi,"");const fit='<script>window.addEventListener("load",()=>{for(const name of document.querySelectorAll("[data-fit-name]")){const box=name.parentElement;let size=Number(name.getAttribute("data-max-font"))||42;name.style.fontSize=size+"pt";while(size>2&&(name.scrollHeight>box.clientHeight||name.scrollWidth>box.clientWidth)){size-=.25;name.style.fontSize=size+"pt"}}})<\\/script>';return /<\\/body\\s*>/i.test(clean)?clean.replace(/<\\/body\\s*>/i,fit+'</body>'):clean+fit}
try{labelHtml=decodeJob();document.getElementById("preview").srcdoc=previewDocument(labelHtml);statusBox.textContent="PC encontrado. La etiqueta está lista.";statusBox.classList.add("ok");printButton.disabled=false}catch(error){statusBox.textContent=error.message;statusBox.classList.add("error")}
printButton.addEventListener("click",async()=>{printButton.disabled=true;statusBox.textContent="Enviando a la impresora…";try{const response=await fetch("/jobs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({html:labelHtml})});const result=await response.json();if(!response.ok)throw new Error(result.error||"No se pudo enviar la etiqueta.");statusBox.textContent=result.dryRun?"Prueba correcta: el puente funciona (sin imprimir).":"Trabajo enviado. Volviendo a la aplicación…";statusBox.className="status ok";if(!result.dryRun){setTimeout(()=>{if(window.opener)window.opener.focus();window.close();setTimeout(()=>location.replace("about:blank"),500)},900)}}catch(error){statusBox.textContent=error.message;statusBox.className="status error";printButton.disabled=false}});
</script></body></html>`;
}

function findEdge() {
  const candidates = [
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.ProgramFiles || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function launchPrint(jobUrl, format) {
  const edge = findEdge();
  if (!edge) throw new Error("No se encuentra Microsoft Edge en el PC.");
  const profilePath = path.resolve(process.cwd(), "outputs", `print-bridge-queue-profile-${format}`);
  fs.mkdirSync(profilePath, { recursive: true });
  const child = spawn(edge, [
    `--user-data-dir=${profilePath}`,
    "--no-first-run",
    "--disable-extensions",
    "--disable-background-mode",
    "--kiosk-printing",
    `--app=${jobUrl}`,
  ], { detached: true, stdio: "ignore", windowsHide: false });
  child.unref();
}

function configurePrinter(format) {
  const queueName = PRINTER_QUEUES[format];
  if (!queueName) throw new Error(`No existe una cola configurada para ${format}.`);
  const printUi = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "rundll32.exe");
  const result = spawnSync(printUi, [
    "printui.dll,PrintUIEntry",
    "/y",
    "/n",
    queueName,
  ], { encoding: "utf8", windowsHide: true, timeout: 15_000 });

  if (result.error) throw new Error(`No se pudo seleccionar la cola ${queueName}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "Error desconocido").trim();
    throw new Error(`No se pudo seleccionar la cola ${queueName}: ${detail}`);
  }
}

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(new Error("La etiqueta es demasiado grande."));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(new Error("La solicitud no es válida.")); }
    });
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (!isPrivateAddress(request.socket.remoteAddress)) {
    response.writeHead(403).end("Acceso permitido solo desde la red local.");
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${PORT}`}`);
  if (request.method === "GET" && url.pathname === "/") {
    const body = bridgePage();
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
    response.end(body);
    return;
  }
  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { ok: true, printer: "Brother QL-570", queues: PRINTER_QUEUES, dryRun: DRY_RUN });
    return;
  }
  if (request.method === "POST" && url.pathname === "/jobs") {
    try {
      const payload = await readJson(request);
      const format = detectPaperFormat(payload.html);
      const html = printableDocument(payload.html);
      const id = crypto.randomUUID();
      jobs.set(id, { html, format, createdAt: Date.now() });
      const jobUrl = `http://127.0.0.1:${PORT}/jobs/${id}/print`;
      if (!DRY_RUN) {
        configurePrinter(format);
        launchPrint(jobUrl, format);
      }
      json(response, 202, { ok: true, id, format, dryRun: DRY_RUN });
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : "No se pudo preparar la etiqueta." });
    }
    return;
  }
  const jobMatch = url.pathname.match(/^\/jobs\/([0-9a-f-]+)\/print$/i);
  if (request.method === "GET" && jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) { response.writeHead(404).end("Trabajo no encontrado o caducado."); return; }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(job.html);
    return;
  }
  response.writeHead(404).end("No encontrado.");
});

function selfTest() {
  if (!isPrivateAddress("::ffff:192.168.1.50") || isPrivateAddress("8.8.8.8")) throw new Error("Falló la validación de red local.");
  const cleaned = sanitizeLabelHtml("<!doctype html><html><body onload=evil()><p>Etiqueta</p><script>evil()</script></body></html>");
  if (/script|onload/i.test(cleaned) || !cleaned.includes("Etiqueta")) throw new Error("Falló la limpieza del HTML.");
  const printable = printableDocument("<!doctype html><html><body><p>Etiqueta</p></body></html>");
  if (!printable.includes("window.print()")) throw new Error("Falló la preparación de impresión.");
  if (detectPaperFormat("<style>@page{size:62mm 30mm;margin:2mm}</style>") !== "62x32") throw new Error("Falló la detección del papel compacto.");
  if (detectPaperFormat("<style>@page { size: 62mm 42mm; }</style>") !== "62x42") throw new Error("Falló la detección del papel grande.");
  if (detectPaperFormat("<style>@page { size: 100mm 62mm; }</style>") !== "62x100") throw new Error("Falló la detección de la etiqueta QR.");
  console.log("Puente de impresión: pruebas correctas.");
}

if (process.argv.includes("--self-test")) {
  selfTest();
} else {
  setInterval(() => {
    const expiry = Date.now() - 10 * 60_000;
    for (const [id, job] of jobs) if (job.createdAt < expiry) jobs.delete(id);
  }, 60_000).unref();
  server.listen(PORT, HOST, () => {
    console.log(`Puente Brother listo en http://192.168.1.36:${PORT}`);
    console.log(DRY_RUN ? "Modo de prueba: no se enviará papel." : "Deja esta ventana abierta mientras imprimes desde el móvil.");
  });
}
