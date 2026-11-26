/* ============================================================
   Usuários online (v8). Presença só em cache (nada é gravado na planilha).
   O navegador envia um pulso a cada 2 minutos, só com a aba visível; online = pulso nos últimos 5 minutos.
   Permissão ver_online. Admin global vê todos os Hubs; os demais só o próprio Hub.
   ============================================================ */
const ONLINE_JANELA_S = 300;
const ONLINE_MAX = 500;
function pulso() { return medir_('pulso', pulsoCore_, arguments); }
function pulsoCore_() {
  const a = exigirAcesso_();
  const c = CacheService.getScriptCache(), agora = Date.now();
  c.put('on:' + a.email, JSON.stringify({ n: a.nome, p: a.perfil, h: a.hubGlobal ? HUB_GLOBAL : (a.hub || ''), t: agora }), ONLINE_JANELA_S + 60);
  let idx = [];
  try { idx = JSON.parse(c.get('on:idx') || '[]'); } catch (e) { idx = []; }
  if (idx.indexOf(a.email) < 0 && idx.length < ONLINE_MAX) { idx.push(a.email); c.put('on:idx', JSON.stringify(idx), 21600); }
  // um pulso só a cada 2 min traz também os selos do menu (antes eram até 5 chamadas separadas, cada uma refazendo o acesso)
  const r = { ok: true, hub: a.hubGlobal ? a.hub : (a.hub || '') };
  const conta = function (campo, pode, fn) { if (!pode) return; try { r[campo] = fn(); } catch (e) { falhaLog_('pulso: ' + campo, e); } }; // um contador com erro só fica de fora
  conta('fb', true, function () { return resumoFb_(a); });
  conta('pend', tem_(a, 'autorizar'), function () { return pendentes_().length; });
  conta('metasNovas', a.telas.indexOf('minhas') > -1, function () { return contarMetasNovas_(a); });
  conta('online', tem_(a, 'ver_online'), function () { return onlineVisiveis_(a).length; });
  return r;
}
function listarOnline() {
  const a = exigirPerm_('ver_online'), vivos = onlineVisiveis_(a);
  vivos.sort(function (x, y) { return x.segundos - y.segundos; });
  return { total: vivos.length, janelaMin: ONLINE_JANELA_S / 60, usuarios: vivos };
}
/** Quem está online e o ator pode ver (Admin global: todos os Hubs; demais: o próprio Hub). Também limpa do índice quem saiu. */
function onlineVisiveis_(a) {
  const c = CacheService.getScriptCache(), agora = Date.now();
  let idx = [];
  try { idx = JSON.parse(c.get('on:idx') || '[]'); } catch (e) { idx = []; }
  const hubs = {};
  lerAba_('Cad_Hubs').forEach(function (h) { hubs[String(h.ID_Hub)] = String(h.Nome); });
  const vivos = [], mantem = [];
  const brutos = {};
  for (let i = 0; i < idx.length; i += 100) Object.assign(brutos, c.getAll(idx.slice(i, i + 100).map(function (e) { return 'on:' + e; })));
  idx.forEach(function (em) {
    let o = null;
    try { o = JSON.parse(brutos['on:' + em] || 'null'); } catch (e) { o = null; }
    if (!o || agora - o.t > ONLINE_JANELA_S * 1000) return;
    mantem.push(em);
    if (a.hubOn && !a.hubGlobal && o.h !== a.hub) return;
    vivos.push({ email: em, nome: o.n, perfil: o.p, hub: o.h, hubNome: hubs[o.h] || '', segundos: Math.round((agora - o.t) / 1000) });
  });
  if (mantem.length !== idx.length) c.put('on:idx', JSON.stringify(mantem), 21600);
  return vivos;
}
