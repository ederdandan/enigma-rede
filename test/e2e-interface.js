// Teste ponta a ponta da interface (jsdom).
// Uso: npm install jsdom@24 (fora do repo ou com --no-save) e depois: node test/e2e-interface.js .
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const dir = process.argv[2];
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const fasesSrc = fs.readFileSync(path.join(dir, 'fases.js'), 'utf8');
html = html.replace('<script src="https://cdn.tailwindcss.com"></script>', '')
  .replace('<script src="fases.js"></script>', () => '<script>' + fasesSrc + '</script>');

// Respostas: executa o mesmo núcleo do jogo no Node.
globalThis.window = globalThis;
require(path.join(dir, 'fases.js'));
const core = new Function(html.slice(html.indexOf('/* === GAME_CORE_START'), html.indexOf('/* === GAME_CORE_END === */')) + '\nreturn { NODES, ANSWERS };')();
const ANS = core.ANSWERS;

let fails = 0, n = 0;
function ok(c, m) { n++; if (!c) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); }

function boot(storage) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.Element.prototype.scrollIntoView = function () {};
      w.onerror = (m) => errors.push(String(m));
      if (storage) Object.keys(storage).forEach(k => w.localStorage.setItem(k, storage[k]));
    }
  });
  return { w: dom.window, d: dom.window.document, errors };
}
const tick = () => new Promise(r => setTimeout(r, 30));
const hidden = (d, id) => d.getElementById(id).classList.contains('hidden');
function dump(w) { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); o[k] = w.localStorage.getItem(k); } return o; }
const st = w => JSON.parse(w.localStorage.getItem('voidbreach_proto_zero_v3') || '{}');

async function submit(d, key) {
  d.getElementById('answerInput').value = key;
  d.getElementById('answerForm').dispatchEvent(new d.defaultView.Event('submit', { cancelable: true }));
  await tick();
}

(async () => {
  let { w, d, errors } = boot();
  await tick();
  console.log('Primeira visita');
  ok(!hidden(d, 'profileModal'), 'modal de perfil aparece');
  ok(hidden(d, 'btnCloseProfile'), 'perfil inicial não pode ser fechado');
  d.getElementById('inputOperatorName').value = 'Tester';
  d.getElementById('btnConfirmProfile').click(); await tick();
  ok(hidden(d, 'profileModal') && !hidden(d, 'helpModal'), 'depois do perfil abre o "Como Jogar"');
  d.getElementById('btnHelpStart').click(); await tick();
  ok(hidden(d, 'helpModal'), 'tutorial fecha');
  ok(d.getElementById('headerCoins').textContent === '120', 'começa com 120 moedas');

  console.log('Progressão travada');
  ok(d.getElementById('btnNextNodeNav').disabled, '▶ desabilitado no nó 1 não resolvido');
  d.getElementById('btnNextNodeNav').click(); await tick();
  ok(st(w).currentGlobalId === 1 || !st(w).currentGlobalId, 'clicar ▶ não avança');
  d.getElementById('btnOpenNodes').click(); await tick();
  const cells = d.querySelectorAll('#nodesGridContainer button');
  ok(cells.length === 30 && !cells[0].disabled && cells[1].disabled && cells[29].disabled, 'mapa: só o nó 1 liberado');
  cells[5].click(); await tick();
  ok(d.getElementById('nodeCodeTag').textContent === 'NODE #01', 'clicar em nó bloqueado não muda de nó');
  const tabs = [...d.querySelectorAll('.profile-tab-btn')].map(b => b.textContent);
  ok(tabs[1].startsWith('🔒'), 'nível Médio aparece bloqueado: ' + tabs[1]);
  d.getElementById('btnJumpUnsolved').click(); await tick();
  ok(hidden(d, 'nodesModal'), 'Próximo Alvo fecha o mapa');

  console.log('Validação da chave');
  await submit(d, 'VB{ERRADA}');
  ok(d.getElementById('feedbackMsg').textContent.includes('incorreta'), 'chave errada é recusada');
  await submit(d, ANS[2]);
  ok(d.getElementById('feedbackMsg').textContent.includes('incorreta'), 'chave de outro nó é recusada');
  await submit(d, 'CHAVE: ' + ANS[1].toLowerCase());
  ok(!hidden(d, 'solvedModal'), 'chave certa (minúscula, com texto junto) é aceita');
  ok(d.getElementById('headerCoins').textContent === '145', 'ganhou 25 moedas');
  d.getElementById('btnStayOnNode').click(); await tick();
  await submit(d, ANS[1]);
  ok(d.getElementById('headerCoins').textContent === '145', 'reenviar a mesma chave não dá moedas (bug antigo)');
  ok(!d.getElementById('btnNextNodeNav').disabled, '▶ liberado após resolver');
  d.getElementById('btnNextNodeNav').click(); await tick();
  ok(d.getElementById('nodeCodeTag').textContent === 'NODE #02', '▶ vai para o nó 2');
  d.getElementById('btnNextNodeNav').click(); await tick();
  ok(d.getElementById('nodeCodeTag').textContent === 'NODE #02', 'não passa do nó 2 sem resolvê-lo');
  d.getElementById('btnPrevNode').click(); await tick();
  ok(d.getElementById('nodeCodeTag').textContent === 'NODE #01', '◀ volta para nó resolvido');
  d.getElementById('btnNextNodeNav').click(); await tick();

  // Resolve 2..10 normalmente até chegar nas fases novas.
  for (let id = 2; id <= 10; id++) {
    await submit(d, ANS[id]);
    d.getElementById('btnProceedNextNode').click(); await tick();
  }
  ok(d.getElementById('nodeCodeTag').textContent === 'NODE #11', 'chegou ao nó 11 resolvendo em sequência');

  console.log('Fase nova: decoder (Comentário Invertido)');
  const src = d.getElementById('simSourceCode').textContent;
  const data = src.match(/backup invertido: (\S+) -->/)[1];
  d.querySelector('[data-sandbox-tab="source"]').click();
  d.getElementById('decoderInput').value = data;
  d.querySelector('[data-decode-op="rev"]').click(); await tick();
  ok(d.getElementById('decoderOutput').textContent === ANS[11], 'Reverse revela a chave');
  ok(!hidden(d, 'btnUseDecoderKey'), 'botão "Usar chave encontrada" aparece');
  d.getElementById('btnUseDecoderKey').click(); await tick(400);
  ok(d.getElementById('answerInput').value === ANS[11], 'botão preenche o campo da chave');
  d.getElementById('btnSubmitAnswer').click(); await tick();
  ok(!hidden(d, 'solvedModal'), 'nó 11 resolvido');
  d.getElementById('btnProceedNextNode').click(); await tick();
  await submit(d, ANS[12]); d.getElementById('btnProceedNextNode').click(); await tick();

  console.log('Fase nova: texto invisível (nó 13)');
  const stealth = d.querySelector('#simWebBody .stealth-text');
  ok(stealth && stealth.textContent === ANS[13], 'texto invisível renderizado na Interface');
  await submit(d, ANS[13]); d.getElementById('btnProceedNextNode').click(); await tick();
  await submit(d, ANS[14]); d.getElementById('btnProceedNextNode').click(); await tick();

  console.log('Fase nova: rotas (Trilha do Crawler, nó 15)');
  const addr = d.getElementById('virtualAddressInput');
  addr.value = 'node://' + addr.value + '/robots.txt/';
  d.getElementById('btnSendAddress').click(); await tick();
  const robots = d.getElementById('simServerOutput').textContent;
  ok(/Disallow: \/painel-/.test(robots), 'robots.txt responde mesmo com node:// e barra final');
  const p = robots.match(/Disallow: (\S+)/)[1];
  addr.value = 'sector-01.void/gate-15' + p;
  d.getElementById('btnSendAddress').click(); await tick();
  ok(d.getElementById('simServerOutput').textContent.includes(ANS[15]), 'painel escondido mostra a chave');
  ok(!hidden(d, 'btnUseServerKey'), 'botão "Usar esta chave" aparece');
  addr.value = 'sector-01.void/gate-15/nao-existe';
  d.getElementById('btnSendAddress').click(); await tick();
  ok(d.getElementById('simServerOutput').textContent.includes('404'), 'rota inexistente dá 404 explicativo');

  console.log('Loja não apaga o que foi digitado');
  d.getElementById('answerInput').value = 'rascunho';
  d.getElementById('hdrCookieRole').value = 'editado';
  d.getElementById('btnOpenShop').click(); await tick();
  [...d.querySelectorAll('.shop-buy-btn')][2].click(); await tick(); // scanner (95)
  ok(d.getElementById('answerInput').value === 'rascunho' && d.getElementById('hdrCookieRole').value === 'editado', 'compra manteve chave digitada e cabeçalhos');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' })); await tick();
  ok(hidden(d, 'shopModal'), 'Esc fecha a loja');
  const coinsAfter = d.getElementById('headerCoins').textContent;

  console.log('Recarregar mantém o progresso');
  let saved = dump(w);
  ({ w, d, errors: errors } = (function (b) { errors.push(...b.errors); return b; })(boot(saved)));
  await tick();
  ok(d.getElementById('nodeCodeTag').textContent === 'NODE #15', 'volta no nó 15');
  ok(d.getElementById('headerCoins').textContent === coinsAfter, 'moedas preservadas: ' + coinsAfter);
  ok(hidden(d, 'profileModal') && hidden(d, 'helpModal'), 'sem modais ao reabrir');

  console.log('Tentativas de burlar pelo save');
  let s = JSON.parse(saved['voidbreach_proto_zero_v3']);
  s.coins = 99999;
  let b = boot(Object.assign({}, saved, { voidbreach_proto_zero_v3: JSON.stringify(s) })); await tick();
  ok(b.d.getElementById('headerCoins').textContent === '0', 'moedas editadas à mão são zeradas');
  s = JSON.parse(saved['voidbreach_proto_zero_v3']);
  s.solvedNodes[15] = true; s.solvedNodes[16] = 'x'; s.solvedNodes[90] = true; s.currentGlobalId = 90;
  b = boot(Object.assign({}, saved, { voidbreach_proto_zero_v3: JSON.stringify(s) })); await tick();
  const s2 = JSON.parse(b.w.localStorage.getItem('voidbreach_proto_zero_v3'));
  ok(Object.keys(s2.solvedNodes).length === 14, 'nós marcados à mão são descartados (ficam 14 legítimos)');
  ok(b.d.getElementById('nodeCodeTag').textContent === 'NODE #15', 'currentGlobalId forçado para 90 volta para a fronteira');
  s = JSON.parse(saved['voidbreach_proto_zero_v3']);
  delete s.solvedNodes[5];
  b = boot(Object.assign({}, saved, { voidbreach_proto_zero_v3: JSON.stringify(s) })); await tick();
  ok(Object.keys(JSON.parse(b.w.localStorage.getItem('voidbreach_proto_zero_v3')).solvedNodes).length === 4, 'buraco na sequência corta o progresso seguinte');
  ok(!/singleNodeDebug|DEV_TEST_VAULT|nodeBadgeHold/.test(html), 'atalho de "segurar o selo" e cofre de respostas removidos');

  console.log('Migração do save antigo (v2)');
  b = boot({ voidbreach_proto_zero_v2: JSON.stringify({ profile: { created: true, name: 'Antigo', avatarType: 'icon', avatarValue: '🦊' }, theme: 'arcane', coins: 5000, solvedNodes: { 1: true, 2: true } }) }); await tick();
  ok(b.d.getElementById('headerOperatorName').textContent === 'Antigo' && b.d.documentElement.getAttribute('data-theme') === 'arcane', 'perfil e tema migrados');
  ok(b.d.getElementById('headerCoins').textContent === '120', 'moedas/progresso antigos não migram');

  errors.push(...b.errors);
  ok(errors.length === 0, 'nenhum erro de JavaScript' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
  console.log('\n' + (fails ? '❌ ' + fails + ' falha(s)' : '✅ Tudo certo') + ' — ' + n + ' verificações');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
