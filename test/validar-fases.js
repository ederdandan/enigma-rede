// Valida as 120 fases do VOIDBREACH.  Uso:  node test/validar-fases.js
// Executa o núcleo real do index.html (trecho GAME_CORE) + fases.js, sem navegador.
'use strict';
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('/* === GAME_CORE_START');
const end = html.indexOf('/* === GAME_CORE_END === */');
if (start < 0 || end < 0) throw new Error('marcadores GAME_CORE não encontrados no index.html');

globalThis.window = globalThis;
const Fases = require(path.join(root, 'fases.js'));
const core = new Function(html.slice(start, end) + '\nreturn { NODES: NODES, ANSWERS: ANSWERS, CryptoVault: CryptoVault };')();
const { NODES, ANSWERS, CryptoVault } = core;

let fails = 0;
let checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fails++; console.log('  ✗ ' + msg); } }

// ---------- 1. Estrutura ----------
ok(NODES.length === 120, 'existem ' + NODES.length + ' nós (esperado 120)');
['Fácil', 'Médio', 'Difícil', 'Mago'].forEach(p => {
  const n = NODES.filter(x => x.profile === p);
  ok(n.length === 30, p + ' tem ' + n.length + ' nós');
  n.forEach((x, i) => ok(x.localIndex === i + 1, p + ' nó fora de ordem: ' + x.localIndex));
});
NODES.forEach((n, i) => ok(n.globalId === i + 1, 'globalId fora de sequência em ' + n.globalId));

// ---------- 2. SHA-256 e chaves ----------
['', 'abc', 'VOIDBREACH_PROTO_ZERO_2026:N001:VB{X}', 'x'.repeat(200)].forEach(s => {
  ok(CryptoVault.sha256(s) === nodeCrypto.createHash('sha256').update(s, 'utf8').digest('hex'), 'SHA-256 diferente do Node para "' + s.slice(0, 20) + '"');
});
const flags = new Set(), hashes = new Set();
NODES.forEach(n => {
  const F = ANSWERS[n.globalId];
  const tag = n.profile + ' #' + n.localIndex;
  ok(/^VB\{(EASY|MED|HARD|MAGO)_[A-Z]+_[0-9A-F]{6}\}$/.test(F), tag + ': formato de chave inválido ' + F);
  ok(!flags.has(F), tag + ': chave repetida'); flags.add(F);
  ok(!hashes.has(n.answerHash), tag + ': hash repetido'); hashes.add(n.answerHash);
  ok(CryptoVault.computeSyncHash(n.globalId, F) === n.answerHash, tag + ': hash não confere com a chave');
  ok(CryptoVault.computeSyncHash(n.globalId, F.toLowerCase()) === n.answerHash, tag + ': minúsculas deveriam ser aceitas');
  ok(CryptoVault.computeSyncHash(n.globalId, 'CHAVE EXTRAÍDA: ' + F + '  ') === n.answerHash, tag + ': colar a linha inteira deveria funcionar');
  const other = ANSWERS[n.globalId === 120 ? 1 : n.globalId + 1];
  ok(CryptoVault.computeSyncHash(n.globalId, other) !== n.answerHash, tag + ': chave de outro nó foi aceita');
  ok(n.hints.length === 3, tag + ': deveria ter 3 dicas');
  ok(n.hints[0].indexOf(F) === -1 && n.hints[1].indexOf(F) === -1, tag + ': dica 1 ou 2 entrega a chave');
  ok(n.hints[2].indexOf(F) !== -1, tag + ': dica 3 deveria revelar a chave');
  ok(n.simSpec.flag === F, tag + ': simSpec.flag diferente da chave');
});
// A chave não pode ser deduzida pela fórmula antiga (perfil_palavra_número).
NODES.forEach(n => ok(!/_\d{2}\}$/.test(ANSWERS[n.globalId]) || /[A-F]/.test(ANSWERS[n.globalId].slice(-7)), 'chave previsível no nó ' + n.globalId));

// ---------- 3. Todas as fases são diferentes ----------
function uniq(label, fn) {
  const seen = new Map();
  NODES.forEach(n => {
    const k = fn(n);
    if (seen.has(k)) ok(false, label + ' repetido: "' + String(k).slice(0, 60) + '" em ' + seen.get(k) + ' e ' + n.profile + ' #' + n.localIndex);
    else seen.set(k, n.profile + ' #' + n.localIndex);
  });
  checks++;
}
uniq('título', n => n.title.replace(/ #\d+$/, ''));
uniq('vetor', n => n.vector);
uniq('mecânica', n => n.solution ? 'extra:' + n.vector : 'classica:' + n.simSpec.type);
uniq('briefing', n => n.briefing);
// Código-fonte com chave, dados e números neutralizados: sobra só a "forma" do desafio.
uniq('código-fonte (estrutura)', n => {
  let s = n.sourceCode.split(ANSWERS[n.globalId]).join('<F>');
  const sol = n.solution;
  if (sol && sol.data) s = s.split(sol.data).join('<D>');
  if (sol && sol.parts) sol.parts.forEach(p => { s = s.split(p.text).join('<P>'); });
  return s.replace(/[A-Za-z0-9+/=%_-]{16,}/g, '<T>').replace(/\d+/g, '#');
});

// ---------- 4. Cada fase extra tem solução, reproduzida pelo mesmo decodificador do jogo ----------
function headersWith(extra) { return Object.assign({}, Fases.DEFAULT_HEADERS, extra || {}); }
function textAt(n, where) {
  if (where === 'source') return n.sourceCode;
  if (where === 'headers') return n.simSpec.headerRule ? (n.simSpec.headerRule(headersWith(n.solution.headers)) || '') : '';
  if (where && where.route) return (n.simSpec.routes || {})[Fases.canonAddress(where.route)] || '';
  return '';
}
let extras = 0;
NODES.filter(n => n.solution).forEach(n => {
  extras++;
  const F = ANSWERS[n.globalId], s = n.solution, tag = n.profile + ' #' + n.localIndex + ' (' + n.title + ')';
  try {
    if (s.stealth) ok(n.simSpec.stealthText === F, tag + ': texto invisível não é a chave');
    if (s.direct) ok(textAt(n, s.where).indexOf(F) !== -1, tag + ': chave não aparece em ' + JSON.stringify(s.where));
    if (s.data) {
      ok(textAt(n, s.where).indexOf(s.data) !== -1, tag + ': dado cifrado não aparece em ' + JSON.stringify(s.where));
      const out = s.ops.reduce((acc, o) => Fases.decodeOp(o.op, acc, o.param), s.data);
      ok(out === F, tag + ': decodificação deu "' + out + '"');
    }
    if (s.parts) {
      s.parts.forEach(p => ok(textAt(n, p.where).indexOf(p.text) !== -1, tag + ': fragmento não encontrado em ' + JSON.stringify(p.where)));
      ok(s.parts.map(p => p.text).join('') === F, tag + ': fragmentos não formam a chave');
    }
    if (s.keyWhere) ok(textAt(n, s.keyWhere).indexOf(s.keyText) !== -1, tag + ': chave auxiliar não é descobrível');
    if (s.via) s.via.forEach((v, i) => {
      const next = (s.via[i + 1] || s.address).slice(n.address.length);
      ok(textAt(n, { route: v }).indexOf(next.split('?')[0]) !== -1, tag + ': ' + v + ' não aponta para ' + next);
    });
    // Sem fazer nada, a chave não pode vazar.
    if (n.simSpec.headerRule) {
      const r = n.simSpec.headerRule(headersWith({}));
      ok(!r || r.indexOf(F) === -1, tag + ': cabeçalhos padrão já liberam a resposta');
    }
    ok(!(n.simSpec.routes || {})[Fases.canonAddress(n.address)], tag + ': endereço inicial já mostra a resposta');
    // Endereço digitado com "node://" e barra final também funciona.
    if (s.address) ok(textAt(n, { route: 'node://' + s.address.replace(/\?.*/, '') + (s.address.indexOf('?') === -1 ? '/' : s.address.slice(s.address.indexOf('?'))) }) !== '', tag + ': endereço com node:// e barra final não é reconhecido');
  } catch (e) {
    ok(false, tag + ': erro ' + e.message);
  }
});
ok(extras === 81, 'esperadas 81 fases extras (80 + Mago #07), encontradas ' + extras);

// ---------- 5. Decoder ----------
const D = Fases.decodeOp;
ok(D('b64d', 'VkJ7WH0') === 'VB{X}', 'B64 sem padding');
ok(D('hexd', '0x56 0x42') === 'VB', 'Hex com 0x e espaços');
ok(D('xor', 'xor 55 0317') === 'VB', 'XOR no formato "xor 55 <hex>"');
ok(D('caesar', 'YE{', '3') === 'VB{', 'César');
ok(D('vig', Fases.encode('VB{TESTE}', [['vig', 'VOID']]), 'void') === 'VB{TESTE}', 'Vigenère');
ok(D('atbash', D('atbash', 'VB{AZ}')) === 'VB{AZ}', 'Atbash');
let threw = false; try { D('caesar', 'abc', '') } catch (e) { threw = true; } ok(threw, 'César sem parâmetro deveria avisar');

console.log('\n' + (fails ? '❌ ' + fails + ' falha(s)' : '✅ Tudo certo') + ' — ' + checks + ' verificações em ' + NODES.length + ' fases (' + extras + ' extras + ' + (NODES.length - extras) + ' clássicas).');
process.exit(fails ? 1 : 0);
