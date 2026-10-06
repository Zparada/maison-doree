/**
 * MAISON DORÉE — servidor privado en tu Google Drive (Google Apps Script)
 * Los datos viven en las pestañas de ESTA hoja de cálculo. Nada sale de tu cuenta de Google.
 * Pasos: ver README.md. Primero ejecuta la función "setup" una sola vez.
 */
const SS = SpreadsheetApp.getActiveSpreadsheet();

// [clave, encabezado en la hoja, tipo: t=texto n=número b=sí/no]
const SCHEMA = {
  users:    {sheet:'Usuarios',  cols:[['id','ID','t'],['name','Nombre','t'],['role','Rol','t'],['pct','% comisión','n'],['phone','Celular','t'],['active','Activo','b'],['must','Debe cambiar clave','b'],['hash','Clave cifrada','t'],['salt','Sal','t']]},
  services: {sheet:'Precios',   cols:[['id','ID','t'],['cat','Categoría','t'],['name','Servicio','t'],['price','Precio','n'],['uses','Consume inventario (id:cantidad)','t']]},
  sales:    {sheet:'Ventas',    cols:[['id','ID','t'],['date','Fecha','t'],['emp','ID empleada','t'],['empName','Empleada','t'],['svc','ID servicio','t'],['name','Servicio','t'],['price','Valor','n'],['pct','% empleada','n'],['method','Medio (cash/tr)','t'],['client','Cliente','t'],['by','Registró (ID)','t'],['at','Marca de tiempo','n']]},
  pays:     {sheet:'Pagos',     cols:[['id','ID','t'],['date','Fecha','t'],['emp','ID empleada','t'],['empName','Empleada','t'],['amt','Valor','n'],['method','Medio (cash/tr)','t'],['kind','Tipo','t'],['note','Nota','t']]},
  notes:    {sheet:'Notas',     cols:[['id','ID','t'],['date','Fecha','t'],['emp','ID empleada','t'],['empName','Empleada','t'],['note','Nota','t']]},
  cash:     {sheet:'Caja',      cols:[['id','ID','t'],['date','Fecha','t'],['open','Efectivo inicial','n']]},
  clients:  {sheet:'Clientes',  cols:[['id','ID','t'],['name','Nombre','t'],['phone','Celular','t'],['bday','Nacimiento','t'],['note','Notas','t']]},
  inventory:{sheet:'Inventario',cols:[['id','ID','t'],['name','Producto','t'],['qty','Cantidad','n'],['min','Mínimo','n'],['cost','Costo','n']]},
  expenses: {sheet:'Gastos',    cols:[['id','ID','t'],['date','Fecha','t'],['concept','Concepto','t'],['amt','Valor','n'],['cat','Categoría','t'],['method','Medio (cash/tr)','t']]},
  appts:    {sheet:'Citas',     cols:[['id','ID','t'],['date','Fecha','t'],['time','Hora','t'],['emp','ID empleada','t'],['empName','Empleada','t'],['client','Cliente','t'],['svc','Servicio','t'],['status','Estado','t'],['note','Nota','t']]},
  goals:    {sheet:'Metas',     cols:[['id','Mes','t'],['meta','Meta','n']]},
  config:   {sheet:'Config',    cols:[['id','Clave','t'],['value','Valor','t']]}
};
const WITH_EMP = ['sales','pays','notes','appts'];

/* ---------- hoja ---------- */
function sh(col){
  const s = SCHEMA[col]; let w = SS.getSheetByName(s.sheet);
  if (!w) {
    w = SS.insertSheet(s.sheet);
    w.getRange(1,1,1,s.cols.length).setValues([s.cols.map(c=>c[1])]).setFontWeight('bold').setBackground('#f1e6e8');
    w.setFrozenRows(1);
  }
  return w;
}
function rows(col){
  const s = SCHEMA[col], w = sh(col), n = w.getLastRow();
  if (n < 2) return [];
  return w.getRange(2,1,n-1,s.cols.length).getValues().map(r => {
    const o = {};
    s.cols.forEach((c,i) => { const x = r[i];
      o[c[0]] = c[2]==='n' ? (+x||0) : c[2]==='b' ? (x===true||x==='TRUE') : (x===''||x==null ? '' : String(x)); });
    return o;
  });
}
function findRow(w, id){
  const n = w.getLastRow(); if (n < 2) return 0;
  const ids = w.getRange(2,1,n-1,1).getValues();
  for (let i=0;i<ids.length;i++) if (String(ids[i][0])===String(id)) return i+2;
  return 0;
}
function upsert(col, rec){
  const s = SCHEMA[col], w = sh(col);
  const row = findRow(w, rec.id) || (w.getLastRow()+1);
  const r = w.getRange(row,1,1,s.cols.length);
  r.setNumberFormats([s.cols.map(c=>c[2]==='t'?'@':'General')]);
  r.setValues([s.cols.map(c=>rec[c[0]]===undefined?'':rec[c[0]])]);
}
function removeRow(col, id){ const w = sh(col), r = findRow(w,id); if (r) w.deleteRow(r); }

/** Si el esquema cambia (columnas nuevas), actualiza los encabezados SIN tocar los datos. */
const SCHEMA_V = '2';
function ensureHeaders(){
  const P = PropertiesService.getScriptProperties();
  if (P.getProperty('schemaV') === SCHEMA_V) return;
  Object.keys(SCHEMA).forEach(col => {
    const s = SCHEMA[col], w = sh(col);
    w.getRange(1,1,1,s.cols.length).setValues([s.cols.map(c=>c[1])]).setFontWeight('bold').setBackground('#f1e6e8');
  });
  P.setProperty('schemaV', SCHEMA_V);
}

/* ---------- seguridad ---------- */
function hash(salt, pass){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt+':'+pass)
    .map(b => ('0'+(b&255).toString(16)).slice(-2)).join('');
}
const uuid = () => Utilities.getUuid().replace(/-/g,'');
function login(name, pass){
  const c = CacheService.getScriptCache();
  const nm = String(name||'').toLowerCase().trim();
  const k = 'f_'+nm.slice(0,40), fails = +c.get(k)||0, all = +c.get('f_all')||0;
  if (fails >= 5 || all >= 60) throw new Error('Demasiados intentos. Espera 10 minutos.');
  const u = rows('users').find(x => x.active && x.name.toLowerCase()===nm);
  if (!u || hash(u.salt, String(pass||'')) !== u.hash) {
    c.put(k, String(fails+1), 600); c.put('f_all', String(all+1), 600);
    Utilities.sleep(900);
    throw new Error('Usuario o clave incorrectos');
  }
  c.remove(k);
  const t = uuid()+uuid();
  c.put('t_'+t, u.id, 21600);
  return {ok:true, token:t};
}
function auth(t){
  const id = t && CacheService.getScriptCache().get('t_'+t);
  const u = id && rows('users').find(x => x.id===id && x.active);
  if (!u) throw new Error('auth');
  return u;
}
const pub = u => ({id:u.id,name:u.name,role:u.role,pct:u.pct,phone:u.phone,active:u.active,must:u.must});
const strip = o => { const x = Object.assign({},o); delete x.hash; delete x.salt; delete x.newpass; return x; };

/* ---------- permisos (se aplican AQUÍ, no en la pantalla) ---------- */
function allowed(u, col, op, rec, old){
  if (u.role==='owner') return true;
  if (u.role==='viewer') return false;
  if (col==='sales')   return op==='put' ? (!old && rec.emp===u.id) : (!!old && old.by===u.id && Date.now()-old.at < 86400000);
  if (col==='clients') return op==='put';
  if (col==='appts')   return op==='put' ? (rec.emp===u.id && (!old || old.emp===u.id)) : (!!old && old.emp===u.id);
  return false;
}
function loadFor(u){
  const out = {};
  Object.keys(SCHEMA).forEach(col => {
    let l = rows(col);
    if (col==='users') l = l.map(strip).filter(x => u.role!=='emp' || x.id===u.id);
    else if (u.role==='emp') {
      if (['sales','pays','notes','appts'].includes(col)) l = l.filter(x => x.emp===u.id);
      else if (!['services','clients','config'].includes(col)) l = [];
    }
    out[col] = l;
  });
  return out;
}

/* ---------- operaciones ---------- */
function adjustInv(svcId, sign){
  const s = rows('services').find(x => x.id===svcId);
  if (!s || !s.uses) return;
  const inv = rows('inventory');
  String(s.uses).split(';').forEach(p => {
    const [id,q] = p.split(':'), it = inv.find(x => x.id===id);
    if (it) { it.qty = Math.max(0, it.qty + sign*(+q||1)); upsert('inventory', it); }
  });
}
function doPut(u, col, rec){
  if (!SCHEMA[col]) throw new Error('Colección inválida');
  rec = rec || {};
  if (col==='users') { delete rec.hash; delete rec.salt; }
  const old = rec.id ? rows(col).find(x => x.id===String(rec.id)) : null;
  if (!allowed(u, col, 'put', rec, old)) throw new Error('No tienes permiso para esto');
  let out = Object.assign({}, old||{}, rec);
  out.id = String(out.id || uuid().slice(0,8));
  if (col==='users') {
    if (!['emp','viewer','owner'].includes(out.role)) throw new Error('Rol inválido');
    if (old && old.role==='owner') { out.role='owner'; out.active=true; out.pct=0; }
    else if (out.role==='owner') throw new Error('Solo puede haber una administradora');
    if (rec.newpass) {
      if (String(rec.newpass).length < 6) throw new Error('La clave debe tener mínimo 6 caracteres');
      out.salt = uuid(); out.hash = hash(out.salt, String(rec.newpass)); out.must = true;
    }
    if (!old && !rec.newpass) throw new Error('Falta la clave inicial');
    if (!old) { out.must = true; out.active = out.active !== false; }
    out.pct = Math.max(0, Math.min(100, +out.pct||0));
  }
  if (col==='sales') {
    if (!(+out.price > 0)) throw new Error('Precio inválido');
    if (!old) { out.at = Date.now(); if (u.role==='emp') { out.emp=u.id; out.pct=u.pct; out.by=u.id; } else out.by = out.by || u.id; }
  }
  if (WITH_EMP.includes(col) && out.emp) { const e = rows('users').find(x => x.id===out.emp); out.empName = e ? e.name : ''; }
  upsert(col, out);
  if (col==='sales') {
    if (!old) adjustInv(out.svc, -1);
    else if (old.svc !== out.svc) { adjustInv(old.svc, +1); adjustInv(out.svc, -1); }
  }
  const res = {ok:true, rec:strip(out)};
  if (col==='sales' && u.role==='owner') res.inv = rows('inventory');
  return res;
}
function doDel(u, col, id){
  if (!SCHEMA[col] || col==='users') throw new Error('No se puede eliminar');
  const old = rows(col).find(x => x.id===String(id));
  if (!old) return {ok:true};
  if (!allowed(u, col, 'del', old, old)) throw new Error('No tienes permiso para esto');
  removeRow(col, id);
  const res = {ok:true};
  if (col==='sales') { adjustInv(old.svc, +1); if (u.role==='owner') res.inv = rows('inventory'); }
  return res;
}
function route(r){
  if (r.a==='login') return login(r.name, r.pass);
  const u = auth(r.t);
  if (r.a==='load') { ensureHeaders(); return {ok:true, user:pub(u), data:loadFor(u)}; }
  if (r.a==='pw') {
    if (String(r.pass||'').length < 6) throw new Error('La clave debe tener mínimo 6 caracteres');
    const l = LockService.getScriptLock(); l.waitLock(25000);
    try { u.salt = uuid(); u.hash = hash(u.salt, String(r.pass)); u.must = false; upsert('users', u); } finally { l.releaseLock(); }
    return {ok:true};
  }
  if (r.a==='put' || r.a==='del') {
    const l = LockService.getScriptLock(); l.waitLock(25000);
    try { return r.a==='put' ? doPut(u, r.col, r.rec) : doDel(u, r.col, r.id); } finally { l.releaseLock(); }
  }
  throw new Error('Acción no válida');
}
function doPost(e){
  let out;
  try { out = route(JSON.parse(e.postData.contents)); }
  catch (err) { out = {ok:false, error:String(err.message||err)}; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(){ return ContentService.createTextOutput('Maison Dorée: servidor activo'); }

/* ---------- instalación (ejecutar UNA vez desde el editor) ---------- */
function setup(){
  Object.keys(SCHEMA).forEach(sh);
  const first = SS.getSheetByName('Hoja 1') || SS.getSheetByName('Sheet1'); if (first) SS.deleteSheet(first);
  if (rows('users').length) { Logger.log('Ya estaba configurado. No se cambió nada.'); return; }
  const mk = (name, role, pct) => {
    const pass = uuid().slice(0,8), salt = uuid();
    upsert('users', {id:uuid().slice(0,8), name, role, pct, phone:'', active:true, must:true, hash:hash(salt,pass), salt});
    Logger.log(name + '  →  clave temporal: ' + pass);
  };
  mk('Zaida Parada','owner',0); mk('Admin 2','viewer',0);
  ['Sharon','Eva','Angelo','Liya'].forEach(n => mk(n,'emp',50));
  [['Cabello','Cepillado (desde)',35000],['Cabello','Corte caballero',22000],['Cabello','Corte niño',18000],['Cabello','Corte dama',25000],['Cabello','Espuntada',20000],['Cabello','Hidrataciones',80000],['Cabello','Aplicación de tintes',45000],
   ['Uñas','Tradicional manos',15000],['Uñas','Tradicional pies',15000],['Uñas','Tradicional manos + pies',28000],['Uñas','Semi manos',35000],['Uñas','Semi pies',35000],['Uñas','Semi manos + pies',68000],['Uñas','Semi hombre manos',30000],
   ['Técnicas uñas','Dual system',70000],['Técnicas uñas','Jelly tips o press on',60000],['Técnicas uñas','Esculpidas',70000],['Técnicas uñas','Sandwich',70000],['Técnicas uñas','Polygel con tips',60000],['Técnicas uñas','Barridos dipping y base rubber',40000],['Técnicas uñas','Polygel',60000],['Técnicas uñas','Acrílico',70000],['Técnicas uñas','Builder gel',70000],['Técnicas uñas','Mantenimiento',55000],
   ['Cejas','Depilación + visajismo',15000],['Cejas','Depilación + visajismo + pigmentación',30000],['Cejas','Laminado',60000],
   ['Pestañas','Pestañas punto a punto',20000],['Pestañas','Pelo a pelo efecto pestañina',70000],['Pestañas','Pelo a pelo efecto 2D',80000],['Pestañas','Pelo a pelo 3D',100000],['Pestañas','Pelo a pelo 4D',120000],['Pestañas','Pelo a pelo 5D',140000]
  ].forEach(s => upsert('services', {id:uuid().slice(0,8), cat:s[0], name:s[1], price:s[2], uses:''}));
  upsert('config', {id:'salon', value:'MAISON DORÉE'});
  Logger.log('Listo. Anota las claves de arriba: cada persona deberá cambiarla al primer ingreso.');
}
/** Si olvidas tu clave: ejecuta esta función y mira el registro. */
function resetOwnerPassword(){
  const u = rows('users').find(x => x.role==='owner'); if (!u) return;
  const pass = uuid().slice(0,8); u.salt = uuid(); u.hash = hash(u.salt, pass); u.must = true; upsert('users', u);
  Logger.log('Clave temporal de ' + u.name + ': ' + pass);
}
