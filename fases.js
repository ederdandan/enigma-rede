/* VOIDBREACH — fases extras (nós 11–30 de cada nível + substituta do Mago #07).
 * Cada fase combina um LUGAR onde a chave está (comentário, meta, rota, cookie, cabeçalho...)
 * com uma CADEIA de codificações/cifras diferente. O teste test/validar-fases.js garante que
 * todas as 120 fases são diferentes e têm solução.
 * Funciona no navegador (window.VB_FASES) e no Node (module.exports).
 */
(function (root) {
  'use strict';

  // ---------- Codificadores ----------
  function utf8(s) { return unescape(encodeURIComponent(String(s))); }
  function fromUtf8(bin) { try { return decodeURIComponent(escape(bin)); } catch (e) { return bin; } }
  function toBase64(s) { return btoa(utf8(s)); }
  function toHex(s) { return Array.from(s).map(function (ch) { return ch.charCodeAt(0).toString(16).padStart(2, '0'); }).join(''); }
  function toBin(s) { return Array.from(s).map(function (ch) { return ch.charCodeAt(0).toString(2).padStart(8, '0'); }).join(' '); }
  function reverse(s) { return Array.from(s).reverse().join(''); }
  function pct(s) { return Array.from(s).map(function (ch) { return '%' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'); }).join(''); }
  function decCodes(s) { return Array.from(s).map(function (ch) { return ch.charCodeAt(0); }).join(', '); }
  function cssEscape(s) { return Array.from(s).map(function (ch) { return '\\' + ch.charCodeAt(0).toString(16); }).join(''); }
  function xorHex(s, key) { return Array.from(s).map(function (ch) { return (ch.charCodeAt(0) ^ key).toString(16).padStart(2, '0'); }).join(''); }
  function shiftLetters(s, n) {
    n = ((n % 26) + 26) % 26;
    return s.replace(/[a-zA-Z]/g, function (ch) {
      var b = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - b + n) % 26) + b);
    });
  }
  function atbash(s) {
    return s.replace(/[a-zA-Z]/g, function (ch) {
      var b = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode(25 - (ch.charCodeAt(0) - b) + b);
    });
  }
  function vigenere(s, key, dir) {
    var k = String(key || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!k) throw new Error('informe a palavra-chave no campo "Parâmetro"');
    var j = 0;
    return s.replace(/[a-zA-Z]/g, function (ch) {
      var b = ch <= 'Z' ? 65 : 97;
      var sh = (k.charCodeAt(j++ % k.length) - 65) * dir;
      return String.fromCharCode(((((ch.charCodeAt(0) - b + sh) % 26) + 26) % 26) + b);
    });
  }
  function splitParts(s, n) {
    var size = Math.ceil(s.length / n), out = [];
    for (var i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
    return out;
  }

  // Cadeia de codificação: ['b64', 'rev', ['xor', 0x2a], ['caesar', 5], ['vig', 'VOID'], ...]
  function encStep(s, step) {
    var name = Array.isArray(step) ? step[0] : step;
    var p = Array.isArray(step) ? step[1] : null;
    switch (name) {
      case 'b64': return toBase64(s);
      case 'hex': return toHex(s);
      case 'bin': return toBin(s);
      case 'rot13': return shiftLetters(s, 13);
      case 'rev': return reverse(s);
      case 'pct': return pct(s);
      case 'dec': return decCodes(s);
      case 'atbash': return atbash(s);
      case 'css': return cssEscape(s);
      case 'caesar': return shiftLetters(s, p);
      case 'xor': return xorHex(s, p);
      case 'vig': return vigenere(s, p, 1);
    }
    throw new Error('passo desconhecido: ' + name);
  }
  function encode(s, chain) { return chain.reduce(encStep, s); }

  var INVERSE = { b64: 'b64d', hex: 'hexd', bin: 'bin', rot13: 'rot13', rev: 'rev', pct: 'urld', dec: 'dec', atbash: 'atbash', css: 'hexd', caesar: 'caesar', xor: 'xor', vig: 'vig' };
  function inverseOps(chain) {
    return chain.slice().reverse().map(function (st) {
      var n = Array.isArray(st) ? st[0] : st;
      var p = Array.isArray(st) ? st[1] : '';
      if (n === 'xor') p = Number(p).toString(16).padStart(2, '0');
      return { op: INVERSE[n], param: String(p) };
    });
  }

  // ---------- Decodificadores (botões do Console / Decoder) ----------
  function decodeOp(op, raw, param) {
    var t = (raw == null ? '' : String(raw)).trim();
    var prm = (param == null ? '' : String(param)).trim();
    if (!t) throw new Error('cole algum texto no campo acima primeiro');
    switch (op) {
      case 'b64d': {
        var b = t.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
        while (b.length % 4) b += '=';
        return fromUtf8(atob(b));
      }
      case 'b64e': return toBase64(t);
      case 'rot13': return shiftLetters(t, 13);
      case 'hexd': {
        var h = t.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
        if (!h || h.length % 2) throw new Error('hexadecimal precisa de pares de dígitos 0-9 / a-f');
        var out = '';
        for (var i = 0; i < h.length; i += 2) out += String.fromCharCode(parseInt(h.substr(i, 2), 16));
        return fromUtf8(out);
      }
      case 'urld': return decodeURIComponent(t);
      case 'rev': return reverse(t);
      case 'bin': {
        var groups = t.replace(/[^01]/g, '').match(/.{1,8}/g);
        if (!groups) throw new Error('binário precisa conter apenas 0 e 1');
        return groups.map(function (g) { return String.fromCharCode(parseInt(g, 2)); }).join('');
      }
      case 'dec': {
        var nums = t.match(/\d+/g);
        if (!nums) throw new Error('nenhum número encontrado');
        return nums.map(function (n) { return String.fromCharCode(Number(n)); }).join('');
      }
      case 'atbash': return atbash(t);
      case 'jwt': {
        var parts = t.split('.');
        if (parts.length < 2) throw new Error('JWT precisa do formato header.payload.assinatura');
        return 'HEADER: ' + decodeOp('b64d', parts[0]) + '\nPAYLOAD: ' + decodeOp('b64d', parts[1]);
      }
      case 'xor': {
        var inline = t.match(/^xor\s+(?:0x)?([0-9a-f]{1,2})\s+([0-9a-f\s]+)$/i);
        var keyHex = inline ? inline[1] : prm.replace(/^0x/i, '');
        var data = (inline ? inline[2] : t).replace(/\s+/g, '');
        if (!/^[0-9a-f]{1,2}$/i.test(keyHex)) throw new Error('informe a chave XOR em hexadecimal no campo "Parâmetro" (ex: 2a)');
        if (!/^([0-9a-f]{2})+$/i.test(data)) throw new Error('o texto cifrado precisa estar em hexadecimal');
        var key = parseInt(keyHex, 16), res = '';
        for (var j = 0; j < data.length; j += 2) res += String.fromCharCode(parseInt(data.substr(j, 2), 16) ^ key);
        return res;
      }
      case 'caesar': {
        // Qualquer número serve: o alfabeto "dá a volta" (29 = 3).
        if (!/^\d{1,3}$/.test(prm)) throw new Error('informe o deslocamento (um número, ex: 3) no campo "Parâmetro"');
        return shiftLetters(t, -Number(prm));
      }
      case 'vig': return vigenere(t, prm, -1);
    }
    throw new Error('operação desconhecida');
  }

  // ---------- Endereços ----------
  // "node://Sector-01.void/gate-01/?b=2&a=1" -> "sector-01.void/gate-01?a=1&b=2"
  function canonAddress(raw) {
    var s = (raw == null ? '' : String(raw)).trim().replace(/^node:\/\//i, '').replace(/^\/+/, '');
    var qi = s.indexOf('?');
    var path = (qi === -1 ? s : s.slice(0, qi)).replace(/\/+$/, '').toLowerCase();
    var query = qi === -1 ? '' : s.slice(qi + 1);
    var params = query.split('&').filter(Boolean).map(function (kv) {
      var ei = kv.indexOf('=');
      var key = ei === -1 ? kv : kv.slice(0, ei);
      var val = ei === -1 ? '' : kv.slice(ei + 1);
      try { val = decodeURIComponent(val.replace(/\+/g, ' ')); } catch (e) {}
      return key.toLowerCase() + '=' + val;
    }).sort();
    return path + (params.length ? '?' + params.join('&') : '');
  }

  var DEFAULT_HEADERS = { loggedin: '0', role: 'guest', referer: 'https://public.void/', ua: 'VoidBrowser/4.2', xff: '198.51.100.42', auth: 'false' };
  function refBase(r) { return String(r || '').trim().replace(/\/+$/, '').toLowerCase(); }

  // ---------- Construtores de fase ----------
  function solFor(where, F, data, chain) {
    return chain && chain.length ? { where: where, data: data, ops: inverseOps(chain) } : { where: where, direct: true };
  }

  // Chave (codificada ou não) dentro do código-fonte.
  function srcP(o) {
    return function (c) {
      var chain = o.chain || [];
      var data = chain.length ? encode(c.F, chain) : c.F;
      return {
        title: o.title, vec: o.vec, surface: o.surface || (chain.length ? 'console' : 'source'),
        briefing: typeof o.briefing === 'function' ? o.briefing(c) : o.briefing,
        hints: o.hints(c, data), method: o.method(c, data),
        source: o.tpl(data, c),
        sol: solFor('source', c.F, data, chain)
      };
    };
  }

  // Chave servida em uma rota acessada pela barra node://
  function routeP(o) {
    return function (c) {
      var chain = o.chain || [];
      var data = chain.length ? encode(c.F, chain) : c.F;
      var map = o.routes(data, c);
      var routes = {};
      Object.keys(map).forEach(function (k) { routes[canonAddress(k)] = map[k]; });
      var target = o.target(c);
      var sol = solFor({ route: target }, c.F, data, chain);
      sol.address = target;
      sol.via = o.via ? o.via(c) : [];
      return {
        title: o.title, vec: o.vec, surface: 'web', briefing: o.briefing, hints: o.hints(c, data), method: o.method(c, data),
        source: o.source(c), routes: routes, sol: sol
      };
    };
  }

  // Chave liberada ao ajustar cookies/cabeçalhos e reenviar.
  function headP(o) {
    return function (c) {
      var chain = o.chain || [];
      var data = chain.length ? encode(c.F, chain) : c.F;
      var sol = solFor('headers', c.F, data, chain);
      sol.headers = o.need(c);
      return {
        title: o.title, vec: o.vec, surface: 'headers', briefing: o.briefing, hints: o.hints(c, data), method: o.method(c, data),
        source: o.source(c),
        headerRule: function (h) { return o.check(h, c) ? o.reply(data, c) : null; },
        sol: sol
      };
    };
  }

  function chainHint(ops) {
    var names = { b64d: 'B64 Dec', hexd: 'Hex Dec', bin: 'Bin Dec', rot13: 'ROT13', rev: 'Reverse', urld: 'URL Dec', dec: 'Dec→Texto', atbash: 'Atbash', caesar: 'César', xor: 'XOR', vig: 'Vigenère' };
    return ops.map(function (o) { return '[' + names[o.op] + ']' + (o.param ? ' (parâmetro ' + o.param + ')' : ''); }).join(' → ');
  }
  var CHAIN_TIP = ' Entre um passo e outro use "⬆ Usar resultado como nova entrada".';
  function steps(chain) { return chainHint(inverseOps(chain)); }

  // =====================================================================
  // FÁCIL — 20 fases (nós 11–30)
  // =====================================================================
  var FACIL = [
    srcP({ title: 'Comentário Invertido', vec: 'Comentário + Reverse', chain: ['rev'],
      briefing: 'Um comentário de backup guarda a chave escrita de trás para frente.',
      tpl: function (d, c) { return '<!DOCTYPE html>\n<body>\n  <h2>Arquivo Morto ' + c.N + '</h2>\n  <!-- backup invertido: ' + d + ' -->\n</body>'; },
      hints: function () { return ['O texto do comentário termina em "{BV": é a chave ao contrário.', 'Envie o texto ao 💻 Decoder e clique em [Reverse].']; },
      method: function (c, d) { return 'Reverse em "' + d + '"'; } }),

    function (c) {
      var p = splitParts(c.F, 2);
      return { title: 'Chave Fatiada', vec: 'Comentários Divididos', surface: 'source',
        briefing: 'Dois desenvolvedores deixaram, cada um, metade da chave em comentários diferentes. Junte as partes na ordem certa.',
        source: '<html>\n<head>\n  <!-- dev-ana: parte 2/2 = ' + p[1] + ' -->\n</head>\n<body>\n  <h2>Portal Interno</h2>\n  <!-- dev-beto: parte 1/2 = ' + p[0] + ' -->\n</body>\n</html>',
        hints: ['Existem dois comentários <!-- -->, cada um com um pedaço.', 'Escreva a parte 1/2 e, colada nela (sem espaço), a parte 2/2.'],
        method: 'juntar "' + p[0] + '" + "' + p[1] + '"',
        sol: { parts: [{ text: p[0], where: 'source' }, { text: p[1], where: 'source' }] } };
    },

    function (c) {
      return { title: 'Tinta Invisível', vec: 'Texto da Cor do Fundo', surface: 'web',
        briefing: 'A chave está escrita na própria Interface do Nó, mas com a mesma cor do fundo.',
        source: '<style>\n  .stealth { color: #020617; background: #020617; }\n</style>\n<p class="stealth">{{ mensagem do servidor }}</p>',
        hints: ['O texto está na tela, só que pintado da mesma cor do fundo.', 'Na aba 🌐 Interface, selecione (arraste o mouse ou toque e segure) a faixa escura de "Mensagem do sistema".'],
        method: 'selecionar o texto invisível na Interface do Nó',
        stealthText: c.F, sol: { stealth: true } };
    },

    srcP({ title: 'Pseudo-Elemento', vec: 'CSS ::after em Hex', chain: ['css'],
      briefing: 'O CSS desenha a chave com um pseudo-elemento ::after, usando códigos de escape hexadecimais.',
      tpl: function (d) { return '<style>\n  .vault::after {\n    content: "' + d + '";\n  }\n</style>\n<div class="vault"></div>'; },
      hints: function () { return ['Em CSS, "\\56" é o caractere de código hexadecimal 56 (a letra V).', 'Copie o valor de content, cole no 💻 Decoder e clique em [Hex Dec] (as barras são ignoradas).']; },
      method: function () { return 'Hex Dec no content do ::after'; } }),

    routeP({ title: 'Trilha do Crawler', vec: 'robots.txt → Painel',
      briefing: 'O /robots.txt deste nó não tem a chave, mas denuncia um painel que não deveria ser visitado. Siga a trilha.',
      source: function (c) { return '<!-- crawlers: ver /robots.txt -->\n<h1>Portal ' + c.N + '</h1>'; },
      target: function (c) { return c.A + '/painel-' + c.w + '-' + c.N; },
      via: function (c) { return [c.A + '/robots.txt']; },
      routes: function (d, c) {
        var r = {};
        r[c.A + '/robots.txt'] = 'User-agent: *\nDisallow: /painel-' + c.w + '-' + c.N;
        r[c.A + '/painel-' + c.w + '-' + c.N] = '[painel restrito]\nCHAVE: ' + d;
        return r;
      },
      hints: function (c) { return ['Leia node://' + c.A + '/robots.txt e veja a linha Disallow.', 'Acesse node://' + c.A + '/painel-' + c.w + '-' + c.N]; },
      method: function (c) { return 'robots.txt → node://' + c.A + '/painel-' + c.w + '-' + c.N; } }),

    routeP({ title: 'Mapa Esquecido', vec: 'sitemap.xml',
      briefing: 'Buscadores usam um mapa do site (sitemap.xml). Uma página arquivada continua listada lá.',
      source: function () { return '<head>\n  <link rel="sitemap" href="/sitemap.xml">\n</head>'; },
      target: function (c) { return c.A + '/arquivo-' + c.N + '.html'; },
      via: function (c) { return [c.A + '/sitemap.xml']; },
      routes: function (d, c) {
        var r = {};
        r[c.A + '/sitemap.xml'] = '<urlset>\n  <url><loc>node://' + c.A + '/</loc></url>\n  <url><loc>node://' + c.A + '/arquivo-' + c.N + '.html</loc></url>\n</urlset>';
        r[c.A + '/arquivo-' + c.N + '.html'] = '<h1>Página arquivada</h1>\n<p>Chave antiga (ainda válida!): ' + d + '</p>';
        return r;
      },
      hints: function (c) { return ['Abra node://' + c.A + '/sitemap.xml e veja as tags <loc>.', 'Acesse node://' + c.A + '/arquivo-' + c.N + '.html']; },
      method: function (c) { return 'sitemap.xml → node://' + c.A + '/arquivo-' + c.N + '.html'; } }),

    srcP({ title: 'Base64 em Dobro', vec: 'Base64 x2', chain: ['b64', 'b64'],
      briefing: 'Alguém achou que codificar em Base64 DUAS vezes deixaria o token seguro.',
      tpl: function (d) { return '// codificado 2x por "segurança"\nconst TOKEN = "' + d + '";'; },
      hints: function () { return ['Decodificar uma vez resulta em... outro Base64.', steps(['b64', 'b64']) + '.' + CHAIN_TIP]; },
      method: function () { return 'B64 Dec duas vezes'; } }),

    srcP({ title: 'Base64 Espelhado', vec: 'Base64 Invertido', chain: ['b64', 'rev'],
      briefing: 'O token está em Base64, mas foi gravado de trás para frente.',
      tpl: function (d) { return '// armazenado invertido\nconst TOKEN = "' + d + '";'; },
      hints: function () { return ['Base64 costuma TERMINAR com "=" — aqui ele está no começo.', steps(['b64', 'rev']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Reverse + B64 Dec'; } }),

    routeP({ title: 'Parâmetros Combinados', vec: 'Dois Parâmetros GET',
      briefing: 'O backend tem um modo de diagnóstico que exige DOIS parâmetros na URL ao mesmo tempo.',
      source: function () { return '// Backend router\nif (req.query.debug === "1" && req.query.verbose === "on") {\n  dumpConfig();\n}'; },
      target: function (c) { return c.A + '?debug=1&verbose=on'; },
      routes: function (d, c) { var r = {}; r[c.A + '?debug=1&verbose=on'] = '[200 OK] Modo diagnóstico\nCHAVE: ' + d; return r; },
      hints: function () { return ['Parâmetros GET vêm depois de "?" e são separados por "&".', 'Acrescente ?debug=1&verbose=on ao endereço e clique em GET.']; },
      method: function (c) { return 'acessar node://' + c.A + '?debug=1&verbose=on'; } }),

    function (c) {
      var p = splitParts(c.F, 3);
      return { title: 'Quebra-Cabeça de Array', vec: 'Ordem de Índices', surface: 'source',
        briefing: 'A senha foi embaralhada em um array e é remontada na hora de validar. Siga a ordem dos índices.',
        source: 'function checkPass(input) {\n  const p = ["' + p[2] + '", "' + p[0] + '", "' + p[1] + '"];\n  const secret = p[1] + p[2] + p[0];\n  return input === secret;\n}',
        hints: ['Arrays começam no índice 0: p[0] é o primeiro item.', 'A senha é p[1] + p[2] + p[0]: 2º item + 3º item + 1º item.'],
        method: 'montar p[1] + p[2] + p[0]',
        sol: { parts: [{ text: p[0], where: 'source' }, { text: p[1], where: 'source' }, { text: p[2], where: 'source' }] } };
    },

    srcP({ title: 'Códigos de Caractere', vec: 'fromCharCode', chain: ['dec'],
      briefing: 'A senha é montada a partir de números: cada um é o código de uma letra.',
      tpl: function (d) { return 'const secret = String.fromCharCode(' + d + ');'; },
      hints: function () { return ['Cada número é o código ASCII de um caractere (86 = V, 66 = B).', 'Copie a lista de números, cole no Decoder e clique em [Dec→Texto].']; },
      method: function () { return 'Dec→Texto sobre os números'; } }),

    srcP({ title: 'Rotação Reversa', vec: 'ROT13 + Reverse', chain: ['rot13', 'rev'],
      briefing: 'Aplicaram ROT13 e depois inverteram o texto. Desfaça as duas etapas.',
      tpl: function (d) { return '[AUDIT_LOG] k = "' + d + '" (pipeline: rot13 -> reverse)'; },
      hints: function () { return ['São duas transformações; desfaça a última primeiro.', steps(['rot13', 'rev']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Reverse + ROT13'; } }),

    routeP({ title: 'Rastro do Editor', vec: 'Backup com Til (~)',
      briefing: 'O dev editou index.php direto no servidor com um editor que salva uma cópia com "~" no final do nome.',
      source: function () { return '<!-- Gerado por index.php (editado em produção) -->\n<h1>Gate</h1>'; },
      target: function (c) { return c.A + '/index.php~'; },
      routes: function (d, c) { var r = {}; r[c.A + '/index.php~'] = '<?php\n  $chave = "' + d + '";\n?>'; return r; },
      hints: function () { return ['Alguns editores criam cópias como arquivo.php~', 'Acrescente /index.php~ ao endereço e clique em GET.']; },
      method: function (c) { return 'acessar node://' + c.A + '/index.php~'; } }),

    srcP({ title: 'Fita Binária', vec: 'Binário', chain: ['bin'],
      briefing: 'Uma fita de backup antiga gravou a chave em binário (grupos de 8 bits).',
      tpl: function (d) { return 'TAPE_DUMP:\n' + d; },
      hints: function () { return ['Cada grupo de 8 zeros e uns é um caractere.', 'Cole os bits no Decoder e clique em [Bin Dec].']; },
      method: function () { return 'Bin Dec na fita'; } }),

    srcP({ title: 'Campo Oculto', vec: 'Input Hidden em Hex', chain: ['hex'],
      briefing: 'O formulário envia um campo escondido (type="hidden") com a chave em hexadecimal.',
      tpl: function (d) { return '<form action="/login" method="post">\n  <input type="hidden" name="vault_hex" value="' + d + '">\n  <input name="user">\n</form>'; },
      hints: function () { return ['Campos type="hidden" não aparecem na tela, mas estão no HTML.', 'Copie o value de vault_hex e use [Hex Dec].']; },
      method: function () { return 'Hex Dec no campo oculto'; } }),

    srcP({ title: 'Texto Alternativo', vec: 'Atributo alt + ROT13', chain: ['rot13'],
      briefing: 'A descrição de acessibilidade (alt) da imagem do cofre esconde a chave cifrada em ROT13.',
      tpl: function (d) { return '<img src="cofre.png" alt="' + d + '" width="64">'; },
      hints: function () { return ['O atributo alt descreve imagens para leitores de tela.', 'Copie o texto do alt e aplique [ROT13].']; },
      method: function () { return 'ROT13 no alt'; } }),

    srcP({ title: 'Meta Esquecida', vec: 'Meta Tag Base64', chain: ['b64'],
      briefing: 'Uma meta tag de verificação ficou no <head> com um valor em Base64.',
      tpl: function (d) { return '<head>\n  <meta charset="utf-8">\n  <meta name="vault-verification" content="' + d + '">\n</head>'; },
      hints: function () { return ['Meta tags ficam no <head> e não aparecem na tela.', 'Copie o content de vault-verification e use [B64 Dec].']; },
      method: function () { return 'B64 Dec no content da meta tag'; } }),

    routeP({ title: 'Leia-me do Projeto', vec: 'README Público',
      briefing: 'O repositório do projeto foi publicado junto com o site, incluindo o arquivo de instruções.',
      source: function () { return '<!-- deploy: cópia completa do repositório (inclui README.md) -->'; },
      target: function (c) { return c.A + '/README.md'; },
      routes: function (d, c) { var r = {}; r[c.A + '/README.md'] = '# Gate\n\n## Setup\n1. npm install\n2. Chave de teste do cofre: ' + d; return r; },
      hints: function () { return ['Repositórios quase sempre têm um README.md.', 'Acrescente /README.md ao endereço e clique em GET.']; },
      method: function (c) { return 'acessar node://' + c.A + '/README.md'; } }),

    routeP({ title: 'Contato de Segurança', vec: 'security.txt', chain: ['b64'],
      briefing: 'Sites publicam um contato de segurança em /.well-known/security.txt. Este veio com um anexo curioso.',
      source: function () { return '<!-- política de divulgação: /.well-known/security.txt -->'; },
      target: function (c) { return c.A + '/.well-known/security.txt'; },
      routes: function (d, c) { var r = {}; r[c.A + '/.well-known/security.txt'] = 'Contact: mailto:sec@void\nExpires: 2030-01-01\n# token-de-teste (base64): ' + d; return r; },
      hints: function (c) { return ['Acesse node://' + c.A + '/.well-known/security.txt', 'O token está em Base64: use [B64 Dec].']; },
      method: function (c) { return 'security.txt + B64 Dec'; } }),

    srcP({ title: 'Cifra de César', vec: 'César (desloc. 3)', chain: [['caesar', 3]],
      briefing: 'Um estagiário "protegeu" a chave com a cifra de César, deslocando cada letra 3 posições.',
      tpl: function (d) { return '<!-- chave (César +3): ' + d + ' -->'; },
      hints: function () { return ['Na cifra de César cada letra anda N posições no alfabeto (A+3 = D).', 'No Decoder, digite 3 no campo "Parâmetro" e clique em [César].']; },
      method: function () { return 'César com deslocamento 3'; } })
  ];

  // =====================================================================
  // MÉDIO — 20 fases
  // =====================================================================
  var MEDIO = [
    headP({ title: 'Booleano Textual', vec: 'Cookie loggedin=true',
      briefing: 'Desta vez o cookie de sessão espera uma palavra, não um número.',
      source: function () { return 'if (req.cookies.loggedin === "true") {\n  send(SECRET);\n}'; },
      need: function () { return { loggedin: 'true' }; }, check: function (h) { return h.loggedin.toLowerCase() === 'true'; },
      reply: function (d) { return '[200 OK] Sessão válida!\nCHAVE: ' + d; },
      hints: function () { return ['Leia exatamente qual valor o servidor compara.', 'Em 📡 Cookies & Headers, coloque "true" no Cookie: loggedin e reenvie.']; },
      method: function () { return 'Cookie loggedin=true'; } }),

    headP({ title: 'Nível de Sessão', vec: 'Cookie Numérico',
      briefing: 'O cookie loggedin guarda o NÍVEL da sessão. Só níveis altos veem o segredo.',
      source: function () { return 'if (parseInt(req.cookies.loggedin, 10) >= 2) {\n  send(SECRET); // nível 2+ = equipe\n}'; },
      need: function () { return { loggedin: '2' }; }, check: function (h) { return parseInt(h.loggedin, 10) >= 2; },
      reply: function (d) { return '[200 OK] Nível de equipe!\nCHAVE: ' + d; },
      hints: function () { return ['parseInt transforma o texto do cookie em número.', 'Use loggedin = 2 e reenvie.']; },
      method: function () { return 'Cookie loggedin=2'; } }),

    headP({ title: 'Superusuário', vec: 'Papel na Lista',
      briefing: 'Aqui "admin" não basta: o sistema tem um papel ainda mais alto.',
      source: function () { return 'const ROLES = ["guest", "user", "admin", "superuser"];\nif (req.cookies.session_role === ROLES[3]) {\n  grantKey();\n}'; },
      need: function () { return { role: 'superuser' }; }, check: function (h) { return h.role === 'superuser'; },
      reply: function (d) { return '[200 OK] Bem-vindo, superusuário!\nCHAVE: ' + d; },
      hints: function () { return ['ROLES[3] é o 4º item da lista (começa em 0).', 'Use session_role = superuser e reenvie.']; },
      method: function () { return 'Cookie session_role=superuser'; } }),

    headP({ title: 'Papel Codificado', vec: 'Papel em Base64',
      briefing: 'O papel exigido está escondido em Base64 no código do servidor.',
      source: function () { return 'if (req.cookies.session_role === atob("' + toBase64('operator') + '")) {\n  grantKey();\n}'; },
      need: function () { return { role: 'operator' }; }, check: function (h) { return h.role === 'operator'; },
      reply: function (d) { return '[200 OK] Operador reconhecido!\nCHAVE: ' + d; },
      hints: function () { return ['atob() decodifica Base64: descubra que palavra é "' + toBase64('operator') + '".', 'É "operator": use session_role = operator e reenvie.']; },
      method: function () { return 'Cookie session_role=operator'; } }),

    headP({ title: 'Painel por Referência', vec: 'Referer com Prefixo',
      briefing: 'O painel confere se você chegou a partir de alguma página dentro de /painel do site admin.',
      source: function () { return 'if (req.headers["referer"].startsWith("https://admin.void/painel")) {\n  send(SECRET);\n}'; },
      need: function () { return { referer: 'https://admin.void/painel' }; },
      check: function (h) { return h.referer.toLowerCase().indexOf('https://admin.void/painel') === 0; },
      reply: function (d) { return '[200 OK] Origem aceita!\nCHAVE: ' + d; },
      hints: function () { return ['startsWith só confere o começo do texto.', 'Use Referer = https://admin.void/painel e reenvie.']; },
      method: function () { return 'Referer https://admin.void/painel'; } }),

    headP({ title: 'Subdomínio de Operações', vec: 'Referer do Setor',
      briefing: 'Só requisições vindas do subdomínio de operações deste setor são aceitas.',
      source: function (c) { return 'const ORIGEM = "ops.' + c.w + '.void";\nif (req.headers["referer"].includes(ORIGEM)) {\n  send(SECRET);\n}'; },
      need: function (c) { return { referer: 'https://ops.' + c.w + '.void/' }; },
      check: function (h, c) { return h.referer.toLowerCase().indexOf('ops.' + c.w + '.void') !== -1; },
      reply: function (d) { return '[200 OK] Subdomínio confiável!\nCHAVE: ' + d; },
      hints: function () { return ['A origem esperada está na constante ORIGEM.', 'Use Referer = https://<valor de ORIGEM>/ e reenvie.']; },
      method: function (c) { return 'Referer https://ops.' + c.w + '.void/'; } }),

    headP({ title: 'Robô Bem-Vindo', vec: 'User-Agent de Robô',
      briefing: 'O site mostra conteúdo extra só para o robô indexador "VoidCrawler". Finja ser ele.',
      source: function () { return 'if (/VoidCrawler/i.test(req.headers["user-agent"])) {\n  send(FULL_CONTENT); // inclui SECRET\n}'; },
      need: function () { return { ua: 'VoidCrawler/1.0' }; }, check: function (h) { return /voidcrawler/i.test(h.ua); },
      reply: function (d) { return '[200 OK] Conteúdo completo para robôs\nCHAVE: ' + d; },
      hints: function () { return ['O teste procura a palavra VoidCrawler em qualquer parte do User-Agent.', 'Use User-Agent = VoidCrawler/1.0 e reenvie.']; },
      method: function () { return 'User-Agent VoidCrawler/1.0'; } }),

    headP({ title: 'Cliente de Terminal', vec: 'User-Agent de CLI',
      briefing: 'A API recusa navegadores: só aceita a ferramenta oficial de terminal "voidctl".',
      source: function () { return 'if (!req.headers["user-agent"].startsWith("voidctl/")) {\n  return send("Use a ferramenta oficial");\n}\nsend(SECRET);'; },
      need: function () { return { ua: 'voidctl/3.1' }; }, check: function (h) { return /^voidctl\//i.test(h.ua); },
      reply: function (d) { return '[200 OK] Cliente oficial\nCHAVE: ' + d; },
      hints: function () { return ['O User-Agent precisa começar com "voidctl/".', 'Use User-Agent = voidctl/3.1 e reenvie.']; },
      method: function () { return 'User-Agent voidctl/3.1'; } }),

    headP({ title: 'Rede Interna', vec: 'IP da Faixa 10.x',
      briefing: 'O sistema libera qualquer IP da rede interna corporativa (faixa 10.x.x.x).',
      source: function () { return 'const ip = req.headers["x-forwarded-for"];\nif (ip.startsWith("10.")) {\n  send(SECRET);\n}'; },
      need: function () { return { xff: '10.0.0.1' }; }, check: function (h) { return /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h.xff); },
      reply: function (d) { return '[200 OK] Rede interna\nCHAVE: ' + d; },
      hints: function () { return ['Qualquer IP começando com "10." passa.', 'Use X-Forwarded-For = 10.0.0.1 e reenvie.']; },
      method: function () { return 'X-Forwarded-For 10.0.0.1'; } }),

    headP({ title: 'Loopback IPv6', vec: 'IP ::1',
      briefing: 'O filtro só aceita o endereço local da máquina no formato IPv6.',
      source: function () { return 'const ip = req.headers["x-forwarded-for"];\nif (ip === "::1") {\n  send(SECRET); // localhost em IPv6\n}'; },
      need: function () { return { xff: '::1' }; }, check: function (h) { return h.xff === '::1'; },
      reply: function (d) { return '[200 OK] Conexão local\nCHAVE: ' + d; },
      hints: function () { return ['Em IPv6, o "127.0.0.1" se escreve de outro jeito.', 'Use X-Forwarded-For = ::1 e reenvie.']; },
      method: function () { return 'X-Forwarded-For ::1'; } }),

    headP({ title: 'Nível Verboso', vec: 'X-Debug por Nível',
      briefing: 'O X-Debug deste servidor tem vários níveis. Só o mais detalhado mostra o segredo.',
      source: function () { return 'const LEVELS = { quiet: 0, info: 1, verbose: 2 };\nif (LEVELS[req.headers["x-debug"]] === 2) {\n  dumpConfig();\n}'; },
      need: function () { return { auth: 'verbose' }; }, check: function (h) { return h.auth.toLowerCase() === 'verbose'; },
      reply: function (d) { return '[200 OK] Log verboso\nMASTER_KEY = ' + d; },
      hints: function () { return ['Qual nome em LEVELS vale 2?', 'Use "Authorization / X-Debug" = verbose e reenvie.']; },
      method: function () { return 'X-Debug verbose'; } }),

    srcP({ title: 'Hex Embrulhado', vec: 'Hex + Base64', chain: ['hex', 'b64'],
      briefing: 'O token foi convertido para hexadecimal e o resultado embrulhado em Base64.',
      tpl: function (d) { return 'INTERCEPTED = "' + d + '"'; },
      hints: function () { return ['A última camada aplicada foi Base64.', steps(['hex', 'b64']) + '.' + CHAIN_TIP]; },
      method: function () { return 'B64 Dec + Hex Dec'; } }),

    srcP({ title: 'URL sobre ROT', vec: 'ROT13 + URL Encode', chain: ['rot13', 'pct'],
      briefing: 'O parâmetro capturado foi cifrado em ROT13 e depois passou por URL-Encoding (%XX).',
      tpl: function (d) { return 'GET /track?ref=' + d; },
      hints: function () { return ['%XX é URL-Encoding: desfaça primeiro.', steps(['rot13', 'pct']) + '.' + CHAIN_TIP]; },
      method: function () { return 'URL Dec + ROT13'; } }),

    routeP({ title: 'Variáveis Expostas', vec: 'Arquivo .env', chain: ['b64'],
      briefing: 'Frameworks guardam configurações num arquivo .env na raiz. Se ele estiver público... a chave vem em Base64.',
      source: function () { return '<!-- framework: Void.js | configuração via arquivo .env -->'; },
      target: function (c) { return c.A + '/.env'; },
      routes: function (d, c) { var r = {}; r[c.A + '/.env'] = 'APP_ENV=production\nAPP_DEBUG=false\nAPP_KEY_B64=' + d; return r; },
      hints: function () { return ['Acrescente /.env ao endereço e clique em GET.', 'APP_KEY_B64 está em Base64: use [B64 Dec].']; },
      method: function (c) { return 'node://' + c.A + '/.env + B64 Dec'; } }),

    routeP({ title: 'Rota Desativada', vec: 'API Comentada',
      briefing: 'Uma chamada de API foi comentada no frontend, mas a rota continua no ar no servidor.',
      source: function () { return '// TODO: reativar depois\n// fetch("/api/internal/health?verbose=true")\nfetch("/api/public/status")'; },
      target: function (c) { return c.A + '/api/internal/health?verbose=true'; },
      routes: function (d, c) { var r = {}; r[c.A + '/api/internal/health?verbose=true'] = '{ "status": "ok", "env": { "VAULT_KEY": "' + d + '" } }'; r[c.A + '/api/public/status'] = '{ "status": "ok" }'; return r; },
      hints: function () { return ['Código comentado (//) não roda, mas revela rotas que existem.', 'Acrescente /api/internal/health?verbose=true ao endereço.']; },
      method: function (c) { return 'node://' + c.A + '/api/internal/health?verbose=true'; } }),

    routeP({ title: 'Consulta GraphQL', vec: 'Schema Exposto',
      briefing: 'O servidor expõe GraphQL e o schema mostra um campo secreto.',
      source: function () { return '# schema:\ntype Query {\n  posts: [Post]\n  vault: Vault\n}\ntype Vault { key: String }\n# endpoint: /graphql?query=...'; },
      target: function (c) { return c.A + '/graphql?query={vault{key}}'; },
      routes: function (d, c) { var r = {}; r[c.A + '/graphql?query={vault{key}}'] = '{ "data": { "vault": { "key": "' + d + '" } } }'; return r; },
      hints: function () { return ['Consultas GraphQL pedem campos entre chaves: {vault{key}}.', 'Acrescente /graphql?query={vault{key}} ao endereço.']; },
      method: function (c) { return 'node://' + c.A + '/graphql?query={vault{key}}'; } }),

    routeP({ title: 'Changelog Revelador', vec: 'CHANGELOG em Hex', chain: ['hex'],
      briefing: 'O histórico de versões do projeto ficou público e cita uma chave "temporária".',
      source: function () { return '<footer>v2.4.1 — <a href="/CHANGELOG.md">novidades</a></footer>'; },
      target: function (c) { return c.A + '/CHANGELOG.md'; },
      routes: function (d, c) { var r = {}; r[c.A + '/CHANGELOG.md'] = '## 2.4.1\n- corrigido login\n- chave temporária (hex): ' + d + '\n## 2.4.0\n- novo tema'; return r; },
      hints: function () { return ['O rodapé do código aponta para /CHANGELOG.md.', 'Leia o arquivo e use [Hex Dec] no valor em hexadecimal.']; },
      method: function () { return 'CHANGELOG.md + Hex Dec'; } }),

    srcP({ title: 'Espelho do Alfabeto', vec: 'Cifra Atbash', chain: ['atbash'],
      briefing: 'A cifra Atbash troca A por Z, B por Y, C por X... O alfabeto vira um espelho.',
      tpl: function (d) { return '<!-- cofre (atbash): ' + d + ' -->'; },
      hints: function () { return ['Atbash é sua própria inversa: aplicar de novo desfaz.', 'Cole o texto no Decoder e clique em [Atbash].']; },
      method: function () { return 'Atbash'; } }),

    function (c) {
      return srcP({ title: 'César do Nó', vec: 'César pelo Número do Nó', chain: [['caesar', c.i]],
        briefing: 'O deslocamento da cifra de César é o próprio número deste nó.',
        tpl: function (d) { return '// shift = número do nó atual\nconst sealed = "' + d + '";'; },
        hints: function () { return ['O número do nó aparece no topo (NODE #XX).', 'No Decoder, coloque ' + c.i + ' em "Parâmetro" e clique em [César].']; },
        method: function () { return 'César com deslocamento ' + c.i; } })(c);
    },

    srcP({ title: 'Binário Invertido', vec: 'Binário + Reverse', chain: ['bin', 'rev'],
      briefing: 'A fita binária foi lida de trás para frente.',
      tpl: function (d) { return 'TAPE_DUMP (reverse):\n' + d; },
      hints: function () { return ['Os bits estão na ordem contrária: desvire antes.', steps(['bin', 'rev']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Reverse + Bin Dec'; } })
  ];

  // =====================================================================
  // DIFÍCIL — 20 fases
  // =====================================================================
  var DIFICIL = [
    srcP({ title: 'XOR Básico', vec: 'XOR Chave 0x2A', chain: [['xor', 0x2a]],
      briefing: 'A chave foi cifrada com XOR de um byte. A chave XOR está no próprio log.',
      tpl: function (d) { return '[CRYPTO] cipher=xor key=0x2a\n[CRYPTO] data=' + d; },
      hints: function () { return ['XOR com a mesma chave desfaz a cifra.', 'No Decoder: cole o data, digite 2a em "Parâmetro" e clique em [XOR].']; },
      method: function () { return 'XOR com chave 2a'; } }),

    srcP({ title: 'Tripla Camada', vec: 'Base64 + ROT13 + URL', chain: ['b64', 'rot13', 'pct'],
      briefing: 'Três camadas: Base64, depois ROT13, depois URL-Encoding. Desfaça uma de cada vez.',
      tpl: function (d) { return 'INTERCEPTED_PAYLOAD = "' + d + '"'; },
      hints: function () { return ['Ordem para desfazer: URL → ROT13 → Base64.', steps(['b64', 'rot13', 'pct']) + '.' + CHAIN_TIP]; },
      method: function () { return 'URL Dec → ROT13 → B64 Dec'; } }),

    srcP({ title: 'Hex Espelhado', vec: 'Base64 + Reverse + Hex', chain: ['b64', 'rev', 'hex'],
      briefing: 'Base64, depois invertido, depois hexadecimal.',
      tpl: function (d) { return 'MEMORY_DUMP [0x0A7C]: ' + d; },
      hints: function () { return ['Desfaça na ordem inversa da descrição.', steps(['b64', 'rev', 'hex']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Hex Dec → Reverse → B64 Dec'; } }),

    headP({ title: 'Admin Codificado', vec: 'Cookie + Base64', chain: ['b64'],
      briefing: 'Como admin, o servidor devolve a chave — mas em Base64.',
      source: function () { return 'if (req.cookies.session_role === "admin") {\n  send(btoa(SECRET));\n}'; },
      need: function () { return { role: 'admin' }; }, check: function (h) { return h.role === 'admin'; },
      reply: function (d) { return '[200 OK] payload=' + d; },
      hints: function () { return ['Mude session_role para admin e reenvie.', 'Copie o payload da resposta e use [B64 Dec].']; },
      method: function () { return 'session_role=admin + B64 Dec'; } }),

    headP({ title: 'Intranet em Hex', vec: 'Referer + Hex', chain: ['hex'],
      briefing: 'Vindo da intranet, o servidor responde com a chave em hexadecimal.',
      source: function () { return 'if (req.headers["referer"] === "https://intranet.void/") {\n  send(toHex(SECRET));\n}'; },
      need: function () { return { referer: 'https://intranet.void/' }; }, check: function (h) { return refBase(h.referer) === 'https://intranet.void'; },
      reply: function (d) { return '[200 OK] hex=' + d; },
      hints: function () { return ['Mude o Referer para https://intranet.void/ e reenvie.', 'Decodifique a resposta com [Hex Dec].']; },
      method: function () { return 'Referer intranet + Hex Dec'; } }),

    routeP({ title: 'Cadeia de Rotas', vec: 'robots → mapa → API', chain: ['b64'],
      briefing: 'Três saltos: o robots.txt aponta um mapa interno, que aponta a API do cofre.',
      source: function () { return '<!-- ver /robots.txt -->'; },
      target: function (c) { return c.A + '/api/cofre-' + c.N; },
      via: function (c) { return [c.A + '/robots.txt', c.A + '/mapa-interno']; },
      routes: function (d, c) {
        var r = {};
        r[c.A + '/robots.txt'] = 'User-agent: *\nDisallow: /mapa-interno';
        r[c.A + '/mapa-interno'] = '{ "rotas": ["/status", "/api/cofre-' + c.N + '"] }';
        r[c.A + '/api/cofre-' + c.N] = '{ "cofre": "' + d + '", "encoding": "base64" }';
        return r;
      },
      hints: function (c) { return ['Comece por node://' + c.A + '/robots.txt e siga cada pista.', 'robots.txt → /mapa-interno → /api/cofre-' + c.N + ', depois [B64 Dec].']; },
      method: function (c) { return 'robots.txt → /mapa-interno → /api/cofre-' + c.N + ' + B64 Dec'; } }),

    function (c) {
      var p = splitParts(c.F, 3);
      return { title: 'Cofre em Três Partes', vec: 'Comentário + Meta + data-*', surface: 'source',
        briefing: 'A chave foi dividida em 3 partes, cada uma escondida em um tipo diferente de lugar do HTML.',
        source: '<head>\n  <meta name="parte-2" content="' + p[1] + '">\n</head>\n<body>\n  <!-- parte 1: ' + p[0] + ' -->\n  <div id="cofre" data-parte-3="' + p[2] + '"></div>\n</body>',
        hints: ['Procure um comentário, uma meta tag e um atributo data-*.', 'Junte parte 1 + parte 2 + parte 3, sem espaços.'],
        method: 'juntar as 3 partes na ordem',
        sol: { parts: [{ text: p[0], where: 'source' }, { text: p[1], where: 'source' }, { text: p[2], where: 'source' }] } };
    },

    srcP({ title: 'César com Pista', vec: 'César (desloc. 7)', chain: [['caesar', 7]],
      briefing: 'O deslocamento da cifra não está escrito — só uma charada.',
      tpl: function (d) { return '// desloque tantas letras quanto os dias da semana\nconst sealed = "' + d + '";'; },
      hints: function () { return ['Quantos dias tem uma semana?', 'No Decoder, Parâmetro = 7 e clique em [César].']; },
      method: function () { return 'César com deslocamento 7'; } }),

    srcP({ title: 'Atbash Invertido', vec: 'Atbash + Reverse', chain: ['atbash', 'rev'],
      briefing: 'Espelho do alfabeto e espelho do texto: duas inversões.',
      tpl: function (d) { return '<!-- selo: ' + d + ' -->'; },
      hints: function () { return ['Uma inversão é das letras (Atbash), a outra da ordem.', steps(['atbash', 'rev']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Reverse + Atbash'; } }),

    srcP({ title: 'Decimal Invertido', vec: 'Reverse + Decimal', chain: ['rev', 'dec'],
      briefing: 'Códigos de caractere de uma chave que já estava de trás para frente.',
      tpl: function (d) { return 'const codes = [' + d + '];'; },
      hints: function () { return ['Primeiro transforme os números em texto.', steps(['rev', 'dec']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Dec→Texto + Reverse'; } }),

    srcP({ title: 'Base64 do Binário', vec: 'Binário + Base64', chain: ['bin', 'b64'],
      briefing: 'A fita binária foi compactada em Base64 para caber no log.',
      tpl: function (d) { return '[BACKUP] tape_b64=' + d; },
      hints: function () { return ['O Base64 esconde zeros e uns.', steps(['bin', 'b64']) + '.' + CHAIN_TIP]; },
      method: function () { return 'B64 Dec + Bin Dec'; } }),

    srcP({ title: 'URL Dupla', vec: 'URL Encode x2', chain: ['pct', 'pct'],
      briefing: 'O valor passou duas vezes por URL-Encoding: o "%" virou "%25".',
      tpl: function (d) { return 'redirect=' + d; },
      hints: function () { return ['"%25" é o próprio "%" codificado.', steps(['pct', 'pct']) + '.' + CHAIN_TIP]; },
      method: function () { return 'URL Dec duas vezes'; } }),

    srcP({ title: 'XOR em Base64', vec: 'XOR + Base64', chain: [['xor', 0x13], 'b64'],
      briefing: 'Os bytes cifrados com XOR (chave 0x13) foram guardados em Base64.',
      tpl: function (d) { return '[CRYPTO] cipher=xor key=0x13 encoding=base64\n[CRYPTO] data=' + d; },
      hints: function () { return ['Base64 primeiro; o resultado é hexadecimal.', steps([['xor', 0x13], 'b64']) + '.' + CHAIN_TIP]; },
      method: function () { return 'B64 Dec + XOR 13'; } }),

    headP({ title: 'Sessão Verbosa', vec: 'Cookie + X-Debug + 2 Camadas', chain: ['rot13', 'b64'],
      briefing: 'O dump só sai com sessão ativa E depuração verbosa — e vem embrulhado.',
      source: function () { return 'if (req.cookies.loggedin === "1" && req.headers["x-debug"] === "verbose") {\n  send(btoa(rot13(SECRET)));\n}'; },
      need: function () { return { loggedin: '1', auth: 'verbose' }; },
      check: function (h) { return h.loggedin === '1' && h.auth.toLowerCase() === 'verbose'; },
      reply: function (d) { return '[200 OK] dump=' + d; },
      hints: function () { return ['Configure loggedin = 1 e X-Debug = verbose ao mesmo tempo.', 'Na resposta: ' + steps(['rot13', 'b64']) + '.']; },
      method: function () { return 'loggedin=1 + X-Debug verbose + B64 Dec + ROT13'; } }),

    headP({ title: 'Auditor Autorizado', vec: 'User-Agent + ROT13', chain: ['rot13'],
      briefing: 'Só a ferramenta de auditoria recebe o relatório, que vem cifrado em ROT13.',
      source: function () { return 'if (req.headers["user-agent"] === "VoidAuditor/2.1") {\n  send(rot13(REPORT));\n}'; },
      need: function () { return { ua: 'VoidAuditor/2.1' }; }, check: function (h) { return h.ua.toLowerCase() === 'voidauditor/2.1'; },
      reply: function (d) { return '[200 OK] erynggbevb: ' + d; },
      hints: function () { return ['Use User-Agent = VoidAuditor/2.1 e reenvie.', 'Aplique [ROT13] na resposta.']; },
      method: function () { return 'UA VoidAuditor/2.1 + ROT13'; } }),

    routeP({ title: 'Backup no Sitemap', vec: 'sitemap → .env.backup', chain: ['hex'],
      briefing: 'O sitemap lista, por engano, um backup da configuração.',
      source: function () { return '<link rel="sitemap" href="/sitemap.xml">'; },
      target: function (c) { return c.A + '/config/.env.backup'; },
      via: function (c) { return [c.A + '/sitemap.xml']; },
      routes: function (d, c) {
        var r = {};
        r[c.A + '/sitemap.xml'] = '<urlset>\n  <url><loc>node://' + c.A + '/</loc></url>\n  <url><loc>node://' + c.A + '/config/.env.backup</loc></url>\n</urlset>';
        r[c.A + '/config/.env.backup'] = 'VAULT_HEX=' + d;
        return r;
      },
      hints: function (c) { return ['Leia node://' + c.A + '/sitemap.xml.', 'Abra /config/.env.backup e use [Hex Dec].']; },
      method: function () { return 'sitemap → /config/.env.backup + Hex Dec'; } }),

    function (c) {
      var p = splitParts(c.F, 4);
      return { title: 'Fatias Embaralhadas', vec: 'Log Fora de Ordem', surface: 'source',
        briefing: 'O log registrou os 4 pedaços da chave fora de ordem. Reorganize pelos números.',
        source: '[03:12] frag 3/4 = ' + p[2] + '\n[03:10] frag 1/4 = ' + p[0] + '\n[03:13] frag 4/4 = ' + p[3] + '\n[03:11] frag 2/4 = ' + p[1],
        hints: ['Cada linha diz qual fragmento é (x/4).', 'Junte frag 1 + 2 + 3 + 4, sem espaços.'],
        method: 'ordenar os fragmentos 1→4',
        sol: { parts: p.map(function (t) { return { text: t, where: 'source' }; }) } };
    },

    srcP({ title: 'César sobre Base64', vec: 'Base64 + César 5', chain: ['b64', ['caesar', 5]],
      briefing: 'Depois do Base64, as letras ainda foram deslocadas 5 posições.',
      tpl: function (d) { return '// enc = caesar(btoa(SECRET), 5)\nconst enc = "' + d + '";'; },
      hints: function () { return ['Desfaça o César antes do Base64.', steps(['b64', ['caesar', 5]]) + '.' + CHAIN_TIP]; },
      method: function () { return 'César 5 + B64 Dec'; } }),

    srcP({ title: 'Vigenère Simples', vec: 'Vigenère (VOID)', chain: [['vig', 'VOID']],
      briefing: 'A cifra de Vigenère desloca cada letra conforme uma palavra-chave. Aqui a palavra é VOID.',
      tpl: function (d) { return '// cifra: vigenere, chave: VOID\nconst sealed = "' + d + '";'; },
      hints: function () { return ['Vigenère usa uma palavra como chave, letra por letra.', 'No Decoder, Parâmetro = VOID e clique em [Vigenère].']; },
      method: function () { return 'Vigenère com chave VOID'; } }),

    srcP({ title: 'ROT Espelhado em Hex', vec: 'ROT13 + Reverse + Hex', chain: ['rot13', 'rev', 'hex'],
      briefing: 'ROT13, inversão e hexadecimal — nessa ordem.',
      tpl: function (d) { return 'DUMP: ' + d; },
      hints: function () { return ['Comece pelo hexadecimal.', steps(['rot13', 'rev', 'hex']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Hex Dec → Reverse → ROT13'; } })
  ];

  // =====================================================================
  // MAGO — 20 fases + substituta do nó #07
  // =====================================================================
  function xorKey(c, base, span, avoid) {
    var k = base + ((c.gid * 7) % span);
    while (avoid.indexOf(k) !== -1) k++;
    return k;
  }

  var MAGO = [
    function (c) {
      var k = xorKey(c, 0x20, 90, [0x55, 0x2a, 0x13, 0x5a]);
      var d = xorHex(c.F, k);
      return { title: 'XOR Texto Conhecido', vec: 'XOR sem Chave', surface: 'console',
        briefing: 'A chave XOR sumiu. Mas toda chave do jogo começa com "V" (0x56)...',
        source: '[CRYPTO] cipher=xor key=???\n[CRYPTO] data=' + d,
        hints: ['O 1º byte cifrado XOR 0x56 ("V") revela a chave: ' + d.slice(0, 2) + ' XOR 56.', 'A chave é ' + k.toString(16).padStart(2, '0') + ': coloque em "Parâmetro" e clique em [XOR].'],
        method: 'XOR com chave ' + k.toString(16).padStart(2, '0'),
        sol: { where: 'source', data: d, ops: [{ op: 'xor', param: k.toString(16).padStart(2, '0') }] } };
    },

    function (c) {
      var k = xorKey(c, 0x30, 60, [0x55, 0x2a, 0x13, 0x5a]);
      var d = xorHex(c.F, k);
      return { title: 'Chave em Decimal', vec: 'XOR com Chave Decimal', surface: 'console',
        briefing: 'A chave XOR foi anotada em decimal, mas o Decoder espera hexadecimal.',
        source: '[CRYPTO] cipher=xor key=' + k + ' (decimal)\n[CRYPTO] data=' + d,
        hints: ['Converta ' + k + ' de decimal para hexadecimal.', k + ' em hex é ' + k.toString(16) + ': use em "Parâmetro" e clique em [XOR].'],
        method: 'XOR com chave ' + k.toString(16),
        sol: { where: 'source', data: d, ops: [{ op: 'xor', param: k.toString(16).padStart(2, '0') }] } };
    },

    srcP({ title: 'Quatro Camadas', vec: 'ROT13 + B64 + Hex + Reverse', chain: ['rot13', 'b64', 'hex', 'rev'],
      briefing: 'ROT13 → Base64 → Hex → Reverse. Quatro camadas, desfaça de trás para frente.',
      tpl: function (d) { return 'ARCANO = "' + d + '"'; },
      hints: function () { return ['A última camada foi a inversão.', steps(['rot13', 'b64', 'hex', 'rev']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Reverse → Hex Dec → B64 Dec → ROT13'; } }),

    function (c) {
      var s = 1 + ((c.gid * 5) % 25);
      if (s === 13 || s === 3 || s === 7) s += 1;
      return srcP({ title: 'César Força-Bruta', vec: 'César sem Deslocamento', chain: [['caesar', s]],
        briefing: 'Ninguém anotou o deslocamento. Teste até aparecer "VB{" no início.',
        tpl: function (d) { return '// shift desconhecido\nconst sealed = "' + d + '";'; },
        hints: function (cc, d) { return ['Compare a 1ª letra cifrada ("' + d.charAt(0) + '") com "V": a distância é o deslocamento.', 'O deslocamento é ' + s + ': Parâmetro = ' + s + ' e [César].']; },
        method: function () { return 'César com deslocamento ' + s; } })(c);
    },

    function (c) {
      var key = 'ARCANO';
      var d = vigenere(c.F, key, 1);
      return { title: 'Vigenère com Chave no Cookie', vec: 'Vigenère + Cookie', surface: 'headers',
        briefing: 'A mensagem cifrada está no código; a palavra-chave só é entregue a quem tem o papel "mago".',
        source: '// sealed (vigenère) = "' + d + '"\nif (req.cookies.session_role === "mago") {\n  send("VIG_KEY=" + KEY);\n}',
        headerRule: function (h) { return h.role === 'mago' ? '[200 OK] VIG_KEY=' + key : null; },
        hints: ['Mude session_role para mago e reenvie para descobrir a palavra-chave.', 'Cole o sealed no Decoder, Parâmetro = ' + key + ' e [Vigenère].'],
        method: 'session_role=mago → Vigenère com ' + key,
        sol: { where: 'source', data: d, ops: [{ op: 'vig', param: key }], keyWhere: 'headers', keyText: key, headers: { role: 'mago' } } };
    },

    headP({ title: 'Tríade Arcana', vec: 'Papel + UA + Referer', chain: ['b64', 'hex'],
      briefing: 'Três condições ao mesmo tempo: papel arquimago, cliente Merlin e origem core.void.',
      source: function () { return 'if (cookies.session_role === "arquimago" &&\n    headers["user-agent"] === "Merlin/1.0" &&\n    headers["referer"] === "https://core.void/") {\n  send(toHex(btoa(SECRET)));\n}'; },
      need: function () { return { role: 'arquimago', ua: 'Merlin/1.0', referer: 'https://core.void/' }; },
      check: function (h) { return h.role === 'arquimago' && h.ua.toLowerCase() === 'merlin/1.0' && refBase(h.referer) === 'https://core.void'; },
      reply: function (d) { return '[200 OK] selo=' + d; },
      hints: function () { return ['Configure os 3 campos e reenvie.', 'Na resposta: ' + steps(['b64', 'hex']) + '.']; },
      method: function () { return 'arquimago + Merlin/1.0 + core.void → Hex Dec → B64 Dec'; } }),

    routeP({ title: 'Labirinto de Rotas', vec: '4 Saltos', chain: ['rot13', 'b64'],
      briefing: 'Quatro saltos entre arquivos públicos até o cofre. Cada um aponta o próximo.',
      source: function () { return '<!-- comece por /robots.txt -->'; },
      target: function (c) { return c.A + '/portal-' + c.N + '/cofre'; },
      via: function (c) { return [c.A + '/robots.txt', c.A + '/portal-' + c.N, c.A + '/portal-' + c.N + '/mapa.json']; },
      routes: function (d, c) {
        var r = {};
        r[c.A + '/robots.txt'] = 'User-agent: *\nDisallow: /portal-' + c.N;
        r[c.A + '/portal-' + c.N] = '<h1>Portal</h1>\n<!-- índice: /portal-' + c.N + '/mapa.json -->';
        r[c.A + '/portal-' + c.N + '/mapa.json'] = '{ "proximo": "/portal-' + c.N + '/cofre" }';
        r[c.A + '/portal-' + c.N + '/cofre'] = '{ "selo": "' + d + '" }';
        return r;
      },
      hints: function (c) { return ['robots.txt → /portal-' + c.N + ' → mapa.json → cofre.', 'No selo: ' + steps(['rot13', 'b64']) + '.']; },
      method: function (c) { return '4 saltos até /portal-' + c.N + '/cofre + B64 Dec + ROT13'; } }),

    function (c) {
      var p = splitParts(c.F, 3);
      var frag = c.A + '/fragmento.txt';
      var routes = {};
      routes[canonAddress(frag)] = 'fragmento B: ' + p[1];
      return { title: 'Fragmentos Dispersos', vec: 'Código + Rota + Cookie', surface: 'source',
        briefing: 'Três fragmentos em três lugares: no código, num arquivo do servidor e numa resposta autenticada.',
        source: '<!-- fragmento A: ' + p[0] + ' -->\n<!-- fragmento B: ver /fragmento.txt -->\n<!-- fragmento C: só com loggedin=1 -->',
        routes: routes,
        headerRule: function (h) { return h.loggedin === '1' ? '[200 OK] fragmento C: ' + p[2] : null; },
        hints: ['A está no código; B em /fragmento.txt; C com o cookie loggedin = 1.', 'Junte A + B + C, sem espaços.'],
        method: 'juntar fragmentos A + B + C',
        sol: { parts: [{ text: p[0], where: 'source' }, { text: p[1], where: { route: frag } }, { text: p[2], where: 'headers' }], headers: { loggedin: '1' } } };
    },

    srcP({ title: 'Atbash Binário', vec: 'Atbash + Binário', chain: ['atbash', 'bin'],
      briefing: 'O texto espelhado pelo Atbash foi gravado bit a bit.',
      tpl: function (d) { return 'RUNA_BIN:\n' + d; },
      hints: function () { return ['Primeiro transforme os bits em texto.', steps(['atbash', 'bin']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Bin Dec + Atbash'; } }),

    srcP({ title: 'URL Hex XOR', vec: 'XOR + URL Encode', chain: [['xor', 0x5a], 'pct'],
      briefing: 'Os bytes cifrados com XOR (chave 0x5a) viajaram URL-encodados.',
      tpl: function (d) { return 'GET /sync?blob=' + d + '\n// cipher=xor key=0x5a'; },
      hints: function () { return ['Desfaça o URL-Encoding: aparece hexadecimal.', steps([['xor', 0x5a], 'pct']) + '.' + CHAIN_TIP]; },
      method: function () { return 'URL Dec + XOR 5a'; } }),

    srcP({ title: 'Base64 Triplo', vec: 'Base64 x3', chain: ['b64', 'b64', 'b64'],
      briefing: 'Três vezes Base64. Paciência de mago.',
      tpl: function (d) { return 'const T = "' + d + '";'; },
      hints: function () { return ['Cada decodificação revela outro Base64.', steps(['b64', 'b64', 'b64']) + '.' + CHAIN_TIP]; },
      method: function () { return 'B64 Dec três vezes'; } }),

    srcP({ title: 'Matrioska', vec: 'B64 + Reverse + Hex + B64', chain: ['b64', 'rev', 'hex', 'b64'],
      briefing: 'Bonecas dentro de bonecas: Base64 → inverso → hex → Base64.',
      tpl: function (d) { return 'MATRIOSKA = "' + d + '"'; },
      hints: function () { return ['Abra a boneca de fora primeiro (o último Base64).', steps(['b64', 'rev', 'hex', 'b64']) + '.' + CHAIN_TIP]; },
      method: function () { return 'B64 Dec → Hex Dec → Reverse → B64 Dec'; } }),

    srcP({ title: 'Decimal de Vigenère', vec: 'Vigenère (MAGO) + Decimal', chain: [['vig', 'MAGO'], 'dec'],
      briefing: 'Cifrado com Vigenère (palavra MAGO) e depois escrito como códigos decimais.',
      tpl: function (d) { return '// vigenere key=MAGO\nconst runas = [' + d + '];'; },
      hints: function () { return ['Converta os números em letras antes.', steps([['vig', 'MAGO'], 'dec']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Dec→Texto + Vigenère MAGO'; } }),

    srcP({ title: 'Atbash Espelhado em Hex', vec: 'Atbash + Reverse + Hex', chain: ['atbash', 'rev', 'hex'],
      briefing: 'Atbash, inversão e hexadecimal.',
      tpl: function (d) { return 'GRIMORIO: ' + d; },
      hints: function () { return ['Comece pelo hexadecimal.', steps(['atbash', 'rev', 'hex']) + '.' + CHAIN_TIP]; },
      method: function () { return 'Hex Dec → Reverse → Atbash'; } }),

    function (c) {
      return headP({ title: 'Selo do Arquiteto', vec: 'Papel + X-Debug + Vigenère', chain: [['vig', c.W]],
        briefing: 'O Arquiteto só entrega o selo cifrado. A palavra-chave é o codinome deste setor.',
        source: function () { return '// NODE_CODENAME = "' + c.W + '"\nif (cookies.session_role === "architect" && headers["x-debug"] === "omega") {\n  send(vigenere(SECRET, NODE_CODENAME));\n}'; },
        need: function () { return { role: 'architect', auth: 'omega' }; },
        check: function (h) { return h.role === 'architect' && h.auth.toLowerCase() === 'omega'; },
        reply: function (d) { return '[200 OK] selo=' + d; },
        hints: function () { return ['session_role = architect e X-Debug = omega.', 'Na resposta: Vigenère com Parâmetro = ' + c.W + '.']; },
        method: function () { return 'architect + omega → Vigenère ' + c.W; } })(c);
    },

    srcP({ title: 'Fita Reversa', vec: 'Binário + Reverse + Base64', chain: ['bin', 'rev', 'b64'],
      briefing: 'Fita binária, rebobinada ao contrário e guardada em Base64.',
      tpl: function (d) { return '[ARCHIVE] fita=' + d; },
      hints: function () { return ['Base64 → Reverse → Bin.', steps(['bin', 'rev', 'b64']) + '.' + CHAIN_TIP]; },
      method: function () { return 'B64 Dec → Reverse → Bin Dec'; } }),

    function (c) {
      var k = xorKey(c, 0x41, 40, [0x55, 0x2a, 0x13, 0x5a]);
      var hx = k.toString(16).padStart(2, '0');
      var d = xorHex(c.F, k);
      var keyPath = c.A + '/xor.key';
      var routes = {};
      routes[canonAddress(keyPath)] = 'KEY=0x' + hx;
      return { title: 'Chave na Rota', vec: 'XOR + Arquivo de Chave', surface: 'console',
        briefing: 'O texto cifrado está no código; a chave XOR foi publicada em um arquivo separado no servidor.',
        source: '// cipher=xor (chave em /xor.key)\nconst sealed = "' + d + '";',
        routes: routes,
        hints: ['Acesse node://' + keyPath + ' para ler a chave.', 'A chave é ' + hx + ': Parâmetro = ' + hx + ' e [XOR].'],
        method: 'ler /xor.key e aplicar XOR ' + hx,
        sol: { where: 'source', data: d, ops: [{ op: 'xor', param: hx }], keyWhere: { route: keyPath }, keyText: hx } };
    },

    function (c) {
      var role = reverse(c.w);
      return headP({ title: 'Cookie Espelhado', vec: 'Papel Invertido + Atbash', chain: ['atbash', 'b64'],
        briefing: 'O papel exigido é o codinome do setor escrito ao contrário.',
        source: function () { return '// codinome: ' + c.w + '\nif (cookies.session_role === reverse(codinome)) {\n  send(btoa(atbash(SECRET)));\n}'; },
        need: function () { return { role: role }; }, check: function (h) { return h.role === role; },
        reply: function (d) { return '[200 OK] runa=' + d; },
        hints: function () { return ['Inverta "' + c.w + '" letra por letra.', 'session_role = ' + role + '; na resposta: ' + steps(['atbash', 'b64']) + '.']; },
        method: function () { return 'session_role=' + role + ' → B64 Dec → Atbash'; } })(c);
    },

    srcP({ title: 'Atbash, URL e Base64', vec: 'Atbash + B64 + URL', chain: ['atbash', 'b64', 'pct'],
      briefing: 'Atbash, depois Base64, depois URL-Encoding.',
      tpl: function (d) { return 'callback?state=' + d; },
      hints: function () { return ['URL primeiro, Atbash por último.', steps(['atbash', 'b64', 'pct']) + '.' + CHAIN_TIP]; },
      method: function () { return 'URL Dec → B64 Dec → Atbash'; } }),

    function (c) {
      var k = xorKey(c, 0x61, 25, [0x55, 0x2a, 0x13, 0x5a]);
      var hx = k.toString(16).padStart(2, '0');
      var d = toBase64(xorHex(c.F, k));
      var robots = c.A + '/robots.txt';
      var routes = {};
      routes[canonAddress(robots)] = 'User-agent: *\nDisallow: /omega\n# chave omega: 0x' + hx;
      return { title: 'Protocolo Final Ω', vec: 'Headers + XOR + Base64', surface: 'headers',
        briefing: 'O núcleo final exige três credenciais. A resposta vem cifrada; a chave XOR está no robots.txt.',
        source: 'if (cookies.session_role === "architect" && headers["x-debug"] === "omega" && headers["x-forwarded-for"] === "127.0.0.1") {\n  send(btoa(xorHex(SECRET, OMEGA_KEY)));\n}',
        routes: routes,
        headerRule: function (h) { return h.role === 'architect' && h.auth.toLowerCase() === 'omega' && h.xff === '127.0.0.1' ? '[200 OK] nucleo=' + d : null; },
        hints: ['architect + X-Debug omega + X-Forwarded-For 127.0.0.1; a chave XOR está em /robots.txt.', 'Resposta: [B64 Dec] → [XOR] com Parâmetro ' + hx + '.'],
        method: 'três credenciais → B64 Dec → XOR ' + hx,
        sol: { where: 'headers', data: d, ops: [{ op: 'b64d', param: '' }, { op: 'xor', param: hx }], headers: { role: 'architect', auth: 'omega', xff: '127.0.0.1' }, keyWhere: { route: robots }, keyText: hx } };
    }
  ];

  // Substitui o nó Mago #07, que antes repetia a fase "Extração de Tabela" do Difícil.
  var MAGO_SLOT7 = function (c) {
    var d = vigenere(c.F, c.W, 1);
    return { title: 'Oráculo de Vigenère', vec: 'Vigenère + Meta Tag', surface: 'console',
      briefing: 'A profecia foi cifrada com Vigenère. A palavra-chave está numa meta tag do próprio oráculo.',
      source: '<head>\n  <meta name="oraculo-chave" content="' + c.W + '">\n</head>\n<body>\n  <!-- profecia: ' + d + ' -->\n</body>',
      hints: ['A meta tag oraculo-chave guarda a palavra-chave.', 'Cole a profecia no Decoder, Parâmetro = ' + c.W + ' e [Vigenère].'],
      method: 'Vigenère com chave ' + c.W,
      sol: { where: 'source', data: d, ops: [{ op: 'vig', param: c.W }], keyWhere: 'source', keyText: c.W } };
  };

  var EXTRA = { 'Fácil': FACIL, 'Médio': MEDIO, 'Difícil': DIFICIL, 'Mago': MAGO };

  // Monta uma fase extra no mesmo formato que o jogo usa para as originais.
  function buildExtra(profile, idx, c) {
    var maker = idx === 'slot7' ? MAGO_SLOT7 : EXTRA[profile][idx];
    var p = maker(c);
    return {
      title: p.title,
      vector: p.vec,
      surfaceTab: p.surface,
      briefing: p.briefing,
      sourceCode: p.source,
      hints: [p.hints[0], p.hints[1], 'Solução: ' + p.method + ' → chave: ' + c.F],
      method: p.method,
      simSpec: { type: 'generic', flag: c.F, routes: p.routes || null, headerRule: p.headerRule || null, stealthText: p.stealthText || null },
      solution: p.sol
    };
  }

  var api = {
    encode: encode, inverseOps: inverseOps, decodeOp: decodeOp,
    canonAddress: canonAddress, DEFAULT_HEADERS: DEFAULT_HEADERS,
    buildExtra: buildExtra, EXTRA_COUNT: { 'Fácil': FACIL.length, 'Médio': MEDIO.length, 'Difícil': DIFICIL.length, 'Mago': MAGO.length }
  };
  root.VB_FASES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
