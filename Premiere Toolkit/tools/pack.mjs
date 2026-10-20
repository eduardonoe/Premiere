/*
 * pack.mjs — monta os zips de distribuicao das duas plataformas.
 *
 * Rodar:  node tools/pack.mjs
 * (o install.ps1 chama isto no fim, para os pacotes nunca ficarem atrasados
 *  em relacao ao codigo)
 *
 * Por que um empacotador proprio em vez de zipar pelo Explorer: o formato ZIP
 * guarda o modo Unix de cada arquivo no campo "external attributes" do
 * diretorio central, e o Archive Utility do macOS o preserva ao descompactar.
 * Gravando 0755 no .command, o destinatario so precisa dar duplo-clique — sem
 * Terminal, sem chmod. O Compress-Archive do PowerShell e o "Enviar para >
 * pasta compactada" do Windows nao escrevem esse campo.
 *
 * Sem compressao (metodo "store"): o conteudo e pequeno e assim o gerador
 * cabe num arquivo, sem dependencia externa.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = join(ROOT, "plugin");
const INSTALL = join(ROOT, "install");
const version = JSON.parse(readFileSync(join(PLUGIN, "manifest.json"), "utf8")).version;

const MODE_FILE = 0o644;
const MODE_EXEC = 0o755;
const MODE_DIR = 0o755;

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* ---------- data/hora no formato DOS ---------- */
const dosTime = (d) =>
  ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
const dosDate = (d) =>
  (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

/* ---------- escrita do zip ---------- */
function writeZip(outPath, entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const crc = e.dir ? 0 : crc32(e.data);
    const size = e.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);      // nome em UTF-8
    local.writeUInt16LE(0, 8);           // store
    local.writeUInt16LE(dosTime(e.mtime), 10);
    local.writeUInt16LE(dosDate(e.mtime), 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, e.data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(0x031e, 4);         // criado em Unix (3), zip 3.0
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(dosTime(e.mtime), 12);
    cd.writeUInt16LE(dosDate(e.mtime), 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    /* o modo Unix vive nos 16 bits altos dos atributos externos */
    const unixMode = (e.dir ? 0x4000 : 0x8000) | e.mode;
    cd.writeUInt32LE((unixMode << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + e.data.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  writeFileSync(outPath, Buffer.concat([...chunks, cdBuf, eocd]));
}

/* ---------- montagem ---------- */
const PREFIX = "Premiere Toolkit/";

function build({ label, files, pluginFiles, dirs, readme, out }) {
  const entries = [];
  /*
   * base = onde o arquivo mora no repositorio (plugin/ ou install/).
   * O nome DENTRO do zip e sempre relativo a raiz: quem recebe encontra o
   * instalador lado a lado com os fontes, sem subpasta para navegar.
   */
  const add = (base, rel) => {
    const abs = join(base, rel);
    entries.push({
      name: PREFIX + rel.split("\\").join("/"),
      data: readFileSync(abs),
      mode: /\.command$/.test(rel) ? MODE_EXEC : MODE_FILE,
      dir: false,
      mtime: statSync(abs).mtime,
    });
  };
  const addDir = (rel) => {
    entries.push({
      name: PREFIX + (rel ? rel.split("\\").join("/") + "/" : ""),
      data: Buffer.alloc(0), mode: MODE_DIR, dir: true, mtime: new Date(),
    });
  };

  addDir("");
  for (const f of files) add(INSTALL, f);
  for (const f of pluginFiles) add(PLUGIN, f);
  for (const d of dirs) {
    addDir(d);
    for (const f of readdirSync(join(PLUGIN, d)).sort()) {
      if (/\.(js|ps1)$/.test(f)) add(PLUGIN, join(d, f));
    }
  }
  entries.push({
    name: PREFIX + "LEIA-ME.txt",
    data: Buffer.from(readme, "utf8"),
    mode: MODE_FILE, dir: false, mtime: new Date(),
  });

  const outPath = join(ROOT, out);
  writeZip(outPath, entries);

  const bytes = statSync(outPath).size;
  console.log(label.padEnd(8) + basename(outPath).padEnd(42) +
              entries.filter((e) => !e.dir).length + " arquivos, " + bytes + " bytes");
  return outPath;
}

/* ---------- Windows ---------- */
build({
  label: "windows",
  files: ["install.ps1", "Install_Premiere_Toolkit.bat", "Uninstall_Premiere_Toolkit.bat"],
  pluginFiles: ["manifest.json", "index.html", "styles.css"],
  /* helpers/ so vai no Windows: e PowerShell puro */
  dirs: ["src", "helpers"],
  out: `Premiere Toolkit ${version} (Windows).zip`,
  readme: `Premiere Toolkit ${version} — Windows

INSTALAR
  Duplo-clique em "Install_Premiere_Toolkit.bat".
  Nao precisa de permissao de administrador: instala no perfil do usuario.

  Depois, reinicie o Premiere Pro e abra o painel em:
      Window > UXP Plugins > Premiere Toolkit

  Nao e em "Window > Extensions" — esse submenu e dos plugins CEP, o modelo
  antigo. Plugin UXP aparece no submenu "UXP Plugins", logo abaixo.

DESINSTALAR
  Duplo-clique em "Uninstall_Premiere_Toolkit.bat".

O QUE TEM NESTA VERSAO
  Clean & Organize   — limpeza e organizacao do Project panel
  Delete Empty Tracks — remove tracks vazias da sequencia ativa
  Un-nest            — desfaz nests pelo clipboard do Premiere

  Delete Empty Tracks precisa de uma calibracao de um minuto na primeira vez:
  clique no icone de alvo ao lado do botao, marque as caixas no dialogo que
  abrir e clique OK. O painel grava a sequencia de cliques e repete depois.

REQUISITOS
  Adobe Premiere Pro 25.6 ou mais novo.
`,
});

/* ---------- macOS ---------- */
build({
  label: "mac",
  files: ["Install_Premiere_Toolkit_Mac.command", "Uninstall_Premiere_Toolkit_Mac.command"],
  pluginFiles: ["manifest.json", "index.html", "styles.css"],
  dirs: ["src"],
  out: `Premiere Toolkit ${version} (Mac).zip`,
  readme: `Premiere Toolkit ${version} — macOS

INSTALAR
  Duplo-clique em "Install_Premiere_Toolkit_Mac.command".

  Na primeira vez o macOS pode barrar por o arquivo vir da internet. Nesse
  caso: clique com o botao direito no arquivo > Abrir > Abrir.

  Depois, reinicie o Premiere Pro e abra o painel em:
      Window > UXP Plugins > Premiere Toolkit

  Se o duplo-clique nao funcionar, abra o Terminal, digite "bash " e arraste
  o arquivo .command para a janela.

DESINSTALAR
  Duplo-clique em "Uninstall_Premiere_Toolkit_Mac.command".

O QUE TEM NESTA VERSAO
  Clean & Organize — limpeza e organizacao do Project panel.

  Delete Empty Tracks e Un-nest existem apenas no Windows: dependem de
  automacao da interface que nao tem equivalente no macOS.

  A opcao do meio se chama "Remove unused" aqui, e nao "Consolidate duplicates
  & remove unused": o Consolidate e comando de menu e nao ha como aciona-lo.
  Nao faz falta — o que nao esta em uso e apagado de qualquer forma.

REQUISITOS
  Adobe Premiere Pro 25.6 ou mais novo.
`,
});
