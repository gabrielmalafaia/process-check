/* ============================================================
   Usuários online (v8). Presença só em cache (nada é gravado na planilha).
   O navegador envia um pulso a cada 2 minutos, só com a aba visível; online = pulso nos últimos 5 minutos.
   Permissão ver_online. Admin global vê todos os Hubs; os demais só o próprio Hub.
   ============================================================ */
const ONLINE_JANELA_S = 300;
const ONLINE_MAX = 500;
function pulso() {
  const a = exigirAcesso_();
  const c = CacheService.getScriptCache(), agora = Date.now();
  c.put('on:' + a.email, JSON.stringify({ n: a.nome, p: a.perfil, h: a.hubGlobal ? HUB_GLOBAL : (a.hub || ''), t: agora }), ONLINE_JANELA_S + 60);
  let idx = [];
  try { idx = JSON.parse(c.get('on:idx') || '[]'); } catch (e) { idx = []; }
  if (idx.indexOf(a.email) < 0 && idx.length < ONLINE_MAX) { idx.push(a.email); c.put('on:idx', JSON.stringify(idx), 21600); }
  return { ok: true, hub: a.hubGlobal ? a.hub : (a.hub || '') };
}
function listarOnline() {
  const a = exigirPerm_('ver_online'), c = CacheService.getScriptCache(), agora = Date.now();
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
  vivos.sort(function (x, y) { return x.segundos - y.segundos; });
  return { total: vivos.length, janelaMin: ONLINE_JANELA_S / 60, usuarios: vivos };
}
