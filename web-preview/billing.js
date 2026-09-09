/* АРМАДА billing: тарифы, лимиты, комиссия биржи, ручная оплата (M0) */
const BILLING_TRIAL_DAYS=30;
const BILLING_GRACE_DAYS=7;
const BILLING_COMMISSION_MIN=500;
const BILLING_COMMISSION_CAP=15000;
const BILLING_ADDON_PRICE=990;
const BILLING_ADDON_UNITS=5;

const BILLING_PLANS={
  start:{
    id:'start', name:'Старт', priceMonthly:2990, priceYearly:30600,
    drivers:3, vehicles:3, admins:1, exchange:false, etrn:false, commissionRate:0
  },
  business:{
    id:'business', name:'Бизнес', priceMonthly:7990, priceYearly:81500,
    drivers:10, vehicles:10, admins:2, exchange:true, etrn:true, commissionRate:0.04
  },
  pro:{
    id:'pro', name:'Профи', priceMonthly:14990, priceYearly:153000,
    drivers:25, vehicles:25, admins:5, exchange:true, etrn:true, commissionRate:0.04
  },
  corporate:{
    id:'corporate', name:'Корпорат', priceMonthly:25000, priceYearly:null,
    drivers:null, vehicles:null, admins:null, exchange:true, etrn:true, commissionRate:0.03
  },
  exchange_lite:{
    id:'exchange_lite', name:'Биржа Lite', priceMonthly:1990, priceYearly:null,
    drivers:0, vehicles:0, admins:1, exchange:true, etrn:false, commissionRate:0.05
  }
};

/** Оператор платформы — 0% комиссии на свои сделки в экосистеме */
const BILLING_OPERATOR_SPACE_NAMES=new Set(['ооо «армада»','ооо армада','армада']);

function billingRoot(){
  if(!state.billing || typeof state.billing!=='object') state.billing={spaces:{}};
  if(!state.billing.spaces || typeof state.billing.spaces!=='object') state.billing.spaces={};
  return state.billing;
}

function billingPlan(planId){
  return BILLING_PLANS[planId] || BILLING_PLANS.start;
}

function isOperatorSpace(space){
  if(!space) return false;
  const nm=(space.name||'').trim().toLowerCase();
  return BILLING_OPERATOR_SPACE_NAMES.has(nm);
}

function addDaysIso(fromIso, days){
  const d=new Date(fromIso||Date.now());
  d.setDate(d.getDate()+days);
  return d.toISOString();
}

function normalizeSpaceBilling(raw, space){
  const planId=raw&&raw.planId && BILLING_PLANS[raw.planId] ? raw.planId : 'start';
  const plan=billingPlan(planId);
  const created=space&&space.createdAt || raw&&raw.createdAt || new Date().toISOString();
  const trialEndsAt=raw&&raw.trialEndsAt || addDaysIso(created, BILLING_TRIAL_DAYS);
  const subscriptionEndsAt=raw&&raw.subscriptionEndsAt || null;
  const graceEndsAt=raw&&raw.graceEndsAt || null;
  const commissionRate=raw&&raw.commissionRate!=null ? +raw.commissionRate : plan.commissionRate;
  return {
    planId,
    trialEndsAt,
    subscriptionEndsAt,
    graceEndsAt,
    status:raw&&raw.status || 'trial',
    balance:Number(raw&&raw.balance)||0,
    commissionRate,
    commissionMin:Number(raw&&raw.commissionMin)||BILLING_COMMISSION_MIN,
    commissionCap:Number(raw&&raw.commissionCap)||BILLING_COMMISSION_CAP,
    exchangeEnabled:raw&&raw.exchangeEnabled!=null ? !!raw.exchangeEnabled : plan.exchange,
    etrnEnabled:raw&&raw.etrnEnabled!=null ? !!raw.etrnEnabled : !!plan.etrn,
    addonDrivers:Number(raw&&raw.addonDrivers)||0,
    addonVehicles:Number(raw&&raw.addonVehicles)||0,
    manualPayments:Array.isArray(raw&&raw.manualPayments)?raw.manualPayments:[],
    ledger:Array.isArray(raw&&raw.ledger)?raw.ledger:[],
    paymentProvider:raw&&raw.paymentProvider || 'manual',
    lastPaymentAt:raw&&raw.lastPaymentAt || null,
    createdAt:created
  };
}

function getBillingForSpace(spaceId){
  if(!spaceId) return null;
  const root=billingRoot();
  const space=findSpaceById(spaceId);
  if(!root.spaces[spaceId]){
    root.spaces[spaceId]=normalizeSpaceBilling(null, space);
  } else {
    root.spaces[spaceId]=normalizeSpaceBilling(root.spaces[spaceId], space);
  }
  return root.spaces[spaceId];
}

function migrateBilling(){
  billingRoot();
  let changed=false;
  (state.spaces||[]).forEach(sp=>{
    const before=JSON.stringify(state.billing.spaces[sp.id]);
    getBillingForSpace(sp.id);
    if(JSON.stringify(state.billing.spaces[sp.id])!==before) changed=true;
  });
  return changed;
}

function billingLimitsForSpace(spaceId){
  const b=getBillingForSpace(spaceId);
  const plan=billingPlan(b.planId);
  const drivers=(plan.drivers!=null?plan.drivers:999)+(b.addonDrivers||0);
  const vehicles=(plan.vehicles!=null?plan.vehicles:999)+(b.addonVehicles||0);
  const admins=plan.admins!=null?plan.admins:999;
  return {drivers, vehicles, admins, plan, billing:b};
}

function billingUsageForSpace(spaceId){
  const drivers=(state.drivers||[]).filter(d=>d.spaceId===spaceId).length;
  const vehicles=(state.vehicles||[]).filter(v=>v.spaceId===spaceId).length;
  const admins=(state.admins||[]).filter(a=>a.spaceId===spaceId).length;
  return {drivers, vehicles, admins};
}

function resolveBillingStatus(spaceId){
  const b=getBillingForSpace(spaceId);
  const now=Date.now();
  const trialEnd=new Date(b.trialEndsAt).getTime();
  const subEnd=b.subscriptionEndsAt ? new Date(b.subscriptionEndsAt).getTime() : null;
  const graceEnd=b.graceEndsAt ? new Date(b.graceEndsAt).getTime() : null;
  if(b.status==='suspended') return 'suspended';
  if(subEnd && subEnd>now) return 'active';
  if(now<=trialEnd) return 'trial';
  if(graceEnd && graceEnd>now) return 'grace';
  if(b.status==='active' && subEnd && subEnd<=now){
    if(!b.graceEndsAt) b.graceEndsAt=addDaysIso(new Date().toISOString(), BILLING_GRACE_DAYS);
    if(new Date(b.graceEndsAt).getTime()>now) return 'grace';
  }
  return 'readonly';
}

function billingCanWrite(spaceId){
  if(!spaceId) return {ok:true};
  const st=resolveBillingStatus(spaceId);
  if(st==='trial' || st==='active' || st==='grace') return {ok:true, status:st};
  if(st==='suspended') return {ok:false, status:st, message:'Подписка приостановлена. Свяжитесь с оператором платформы.'};
  return {ok:false, status:st, message:'Период оплаты истёк — режим только просмотра. Оплатите подписку или продлите пилот.'};
}

function billingCanUseExchange(spaceId){
  const b=getBillingForSpace(spaceId);
  const st=resolveBillingStatus(spaceId);
  if(st==='readonly' || st==='suspended') return {ok:false, message:'Биржа отключена — оплатите подписку или продлите пилот.'};
  if(!b.exchangeEnabled) return {ok:false, message:'Биржа не включена в тариф. Перейдите на «Бизнес» или «Биржа Lite».'};
  return {ok:true};
}

function billingCanExport(spaceId){
  const st=resolveBillingStatus(spaceId);
  if(st==='grace') return {ok:false, message:'Экспорт отключён в период grace — оплатите подписку.'};
  if(st==='readonly' || st==='suspended') return {ok:false, message:'Экспорт недоступен — оплатите подписку.'};
  return {ok:true};
}

function billingCanUseEtrn(spaceId){
  const b=getBillingForSpace(spaceId);
  const st=resolveBillingStatus(spaceId);
  if(st==='trial') return {ok:true};
  if(st==='readonly' || st==='suspended') return {ok:false, message:'ЭТрН недоступен — оплатите подписку.'};
  if(st==='grace') return {ok:false, message:'ЭТрН отключён в grace — оплатите подписку.'};
  if(!b.etrnEnabled) return {ok:false, message:'ЭТрН в тарифе «Бизнес» и выше (оператор ЭПД — отдельно).'};
  return {ok:true};
}

function billingGuard(spaceId, action){
  const writeActions=new Set(['create_order','edit_order','close_order','add_driver','add_vehicle','add_admin','publish_exchange','claim_exchange','create_shift','create_etrn']);
  if(writeActions.has(action)){
    const w=billingCanWrite(spaceId);
    if(!w.ok) return w;
  }
  if(action==='publish_exchange' || action==='claim_exchange'){
    const ex=billingCanUseExchange(spaceId);
    if(!ex.ok) return ex;
  }
  if(action==='export_data'){
    const ex=billingCanExport(spaceId);
    if(!ex.ok) return ex;
  }
  if(action==='create_etrn'){
    const et=billingCanUseEtrn(spaceId);
    if(!et.ok) return et;
  }
  if(action==='add_driver'){
    const lim=billingLimitsForSpace(spaceId);
    const use=billingUsageForSpace(spaceId);
    if(use.drivers>=lim.drivers) return {ok:false, message:`Лимит водителей (${lim.drivers}). Upgrade тарифа или add-on +${BILLING_ADDON_UNITS}.`};
  }
  if(action==='add_vehicle'){
    const lim=billingLimitsForSpace(spaceId);
    const use=billingUsageForSpace(spaceId);
    if(use.vehicles>=lim.vehicles) return {ok:false, message:`Лимит ТС (${lim.vehicles}). Upgrade тарифа или add-on +${BILLING_ADDON_UNITS}.`};
  }
  if(action==='add_admin'){
    const lim=billingLimitsForSpace(spaceId);
    const use=billingUsageForSpace(spaceId);
    if(use.admins>=lim.admins) return {ok:false, message:`Лимит админов (${lim.admins}). Upgrade тарифа.`};
  }
  return {ok:true};
}
/** Серверная проверка через armada-api (C-05). null если API недоступен. */
async function billingGuardApi(spaceId, action){
  if(!API_BASE || typeof armadaApiJsonHeaders!=='function') return null;
  try{
    const b=getBillingForSpace(spaceId);
    const usage=billingUsageForSpace(spaceId);
    const res=await fetch(`${API_BASE}/billing/guard`, {
      method:'POST',
      headers:armadaApiJsonHeaders(),
      body:JSON.stringify({ spaceId, action, billingSpace:b, usage })
    });
    if(!res.ok) return null;
    return await res.json();
  }catch(_){ return null; }
}
/** Локальный guard + сервер (если API доступен). */
async function billingGuardWithServer(spaceId, action){
  const local=billingGuard(spaceId, action);
  if(!local.ok) return local;
  const remote=await billingGuardApi(spaceId, action);
  if(remote && remote.ok===false) return remote;
  return local;
}

function billingGuardCurrentAdmin(action){
  const sid=currentSpaceId();
  if(!sid && currentAdmin && currentAdmin.isSuper) return {ok:true};
  return billingGuard(sid, action);
}
/** C-05: локальный guard + armada-api для текущего space админа. */
async function billingGuardCurrentAdminWithServer(action){
  const sid=currentSpaceId();
  if(!sid && currentAdmin && currentAdmin.isSuper) return {ok:true};
  return await billingGuardWithServer(sid, action);
}

function billingOrderCommissionBase(order){
  if(!order) return 0;
  try{
    if(typeof clientRate==='function') return Math.max(0, +clientRate(order)||0);
  }catch(_){}
  if(order.rateCash!=null) return Math.max(0, +order.rateCash);
  if(order.freight!=null) return Math.max(0, +order.freight);
  return 0;
}

function calcExchangeCommissionAmount(order, billing){
  const base=billingOrderCommissionBase(order);
  if(!(base>0)) return 0;
  const rate=billing&&billing.commissionRate!=null ? +billing.commissionRate : 0.04;
  if(!(rate>0)) return 0;
  const min=billing&&billing.commissionMin!=null ? +billing.commissionMin : BILLING_COMMISSION_MIN;
  const cap=billing&&billing.commissionCap!=null ? +billing.commissionCap : BILLING_COMMISSION_CAP;
  let amt=Math.round(base*rate);
  if(amt<min) amt=min;
  if(cap>0 && amt>cap) amt=cap;
  return amt;
}

function exchangeCommissionSpaceId(order){
  if(!order) return null;
  if(order.partnerSpaceId) return order.partnerSpaceId;
  if(order.spaceId) return order.spaceId;
  return null;
}

function isExchangeDealOrder(order){
  if(!order) return false;
  if(order.exchangeCommissionApplied) return false;
  return !!(order.exchangeListedAt || order.partnerSpaceId || order.wasOnExchange);
}

function orderClosedForBilling(order){
  if(typeof looksClosedOrder==='function') return looksClosedOrder(order);
  if(!order||order.cancelledAt) return false;
  return !!(order.closedAt || (order.endOdometer!=null && order.loadedKm!=null));
}

function removeBillingEntriesForOrders(orderIds){
  const delSet=new Set((orderIds||[]).filter(Boolean));
  if(!delSet.size) return false;
  let changed=false;
  const root=billingRoot();
  Object.keys(root.spaces||{}).forEach(spaceId=>{
    const b=root.spaces[spaceId];
    if(!b||!Array.isArray(b.ledger)) return;
    const remove=b.ledger.filter(e=>e&&e.orderId&&delSet.has(e.orderId));
    if(!remove.length) return;
    let balanceDelta=0;
    remove.forEach(e=>{
      if(e.type==='exchange_commission') balanceDelta+=Math.abs(Number(e.amount)||0);
    });
    b.ledger=b.ledger.filter(e=>!e||!e.orderId||!delSet.has(e.orderId));
    if(balanceDelta>0) b.balance=(Number(b.balance)||0)+balanceDelta;
    changed=true;
  });
  if(changed) bumpDataEpoch('billing-order-delete');
  return changed;
}

function maybeApplyExchangeCommission(order){
  if(!order || !isExchangeDealOrder(order)) return false;
  if(!orderClosedForBilling(order)) return false;
  const spaceId=exchangeCommissionSpaceId(order);
  if(!spaceId) return false;
  const space=findSpaceById(spaceId);
  if(isOperatorSpace(space)) {
    order.exchangeCommissionApplied=true;
    order.exchangeCommissionAmount=0;
    order.exchangeCommissionSpaceId=spaceId;
    return true;
  }
  const billing=getBillingForSpace(spaceId);
  const amount=calcExchangeCommissionAmount(order, billing);
  if(amount<=0){
    order.exchangeCommissionApplied=true;
    return true;
  }
  billing.balance=(Number(billing.balance)||0)-amount;
  const entry={
    id:uuid(),
    type:'exchange_commission',
    amount:-amount,
    at:order.closedAt || new Date().toISOString(),
    orderId:order.id,
    orderSeq:order.sequentialNumber,
    base:billingOrderCommissionBase(order),
    rate:billing.commissionRate,
    note:`Комиссия биржи №${order.sequentialNumber||'—'}`
  };
  billing.ledger=(billing.ledger||[]).concat([entry]);
  order.exchangeCommissionApplied=true;
  order.exchangeCommissionAmount=amount;
  order.exchangeCommissionSpaceId=spaceId;
  bumpDataEpoch('exchange-commission');
  return true;
}

function onOrderClosedBilling(order){
  if(!order) return false;
  let changed=false;
  if(maybeApplyExchangeCommission(order)) changed=true;
  return changed;
}

function recordManualPayment(spaceId, amountRub, note, recordedBy){
  const b=getBillingForSpace(spaceId);
  const amt=Math.round(+amountRub);
  if(!(amt>0)) return false;
  const at=new Date().toISOString();
  const pay={
    id:uuid(), amount:amt, at, note:String(note||'').trim(),
    recordedBy:recordedBy||null, provider:'manual'
  };
  b.manualPayments=(b.manualPayments||[]).concat([pay]);
  b.balance=(Number(b.balance)||0)+amt;
  b.lastPaymentAt=at;
  b.ledger=(b.ledger||[]).concat([{
    id:uuid(), type:'manual_payment', amount:amt, at, note:pay.note||'Ручная оплата', paymentId:pay.id
  }]);
  const months=Math.round(amt/(billingPlan(b.planId).priceMonthly||2990));
  if(months>=1){
    const base=b.subscriptionEndsAt && new Date(b.subscriptionEndsAt).getTime()>Date.now()
      ? b.subscriptionEndsAt : new Date().toISOString();
    b.subscriptionEndsAt=addDaysIso(base, months*30);
    b.status='active';
    b.graceEndsAt=null;
  }
  bumpDataEpoch('manual-payment');
  return true;
}

function setSpaceBillingPlan(spaceId, planId, opts){
  const b=getBillingForSpace(spaceId);
  if(!BILLING_PLANS[planId]) return false;
  b.planId=planId;
  const plan=billingPlan(planId);
  b.exchangeEnabled=plan.exchange;
  b.etrnEnabled=!!plan.etrn;
  if(plan.commissionRate!=null) b.commissionRate=plan.commissionRate;
  if(opts&&opts.trialEndsAt) b.trialEndsAt=opts.trialEndsAt;
  if(opts&&opts.subscriptionEndsAt) b.subscriptionEndsAt=opts.subscriptionEndsAt;
  if(opts&&opts.status) b.status=opts.status;
  bumpDataEpoch('billing-plan');
  return true;
}

/** Пилот: тариф «Бизнес», биржа и ЭТрН на время trial. */
function bootstrapPilotSpace(spaceId, opts){
  opts=opts||{};
  if(!spaceId) return false;
  const planId=opts.planId||'business';
  if(!BILLING_PLANS[planId]) return false;
  const extendDays=opts.extendDays!=null?opts.extendDays:BILLING_TRIAL_DAYS;
  setSpaceBillingPlan(spaceId, planId, {status:'trial'});
  const b=getBillingForSpace(spaceId);
  if(b){
    b.exchangeEnabled=true;
    b.etrnEnabled=true;
  }
  if(extendDays>0) extendSpaceTrial(spaceId, extendDays);
  bumpDataEpoch('bootstrap-pilot');
  return true;
}

function extendSpaceTrial(spaceId, days){
  const b=getBillingForSpace(spaceId);
  const base=new Date(b.trialEndsAt).getTime()>Date.now() ? b.trialEndsAt : new Date().toISOString();
  b.trialEndsAt=addDaysIso(base, days||BILLING_TRIAL_DAYS);
  b.status='trial';
  bumpDataEpoch('billing-trial-extend');
  return true;
}

function formatRub(n){
  const v=Math.round(+n||0);
  return v.toLocaleString('ru-RU')+' ₽';
}
function formatBillingDate(iso){
  if(!iso) return '—';
  try{
    return new Date(iso).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
  }catch(_){ return String(iso); }
}

function billingStatusLabel(st){
  if(st==='trial') return 'Пилот';
  if(st==='active') return 'Активна';
  if(st==='grace') return 'Grace (7 дн.)';
  if(st==='readonly') return 'Только просмотр';
  if(st==='suspended') return 'Приостановлена';
  return st||'—';
}

function billingBannerForAdmin(){
  const sid=currentSpaceId();
  if(!sid || (currentAdmin&&currentAdmin.isSuper)) return '';
  const st=resolveBillingStatus(sid);
  const b=getBillingForSpace(sid);
  const lim=billingLimitsForSpace(sid);
  const use=billingUsageForSpace(sid);
  const parts=[];
  parts.push(`Тариф: ${lim.plan.name} · ${billingStatusLabel(st)}`);
  if(st==='trial') parts.push(`пилот до ${formatBillingDate(b.trialEndsAt)}`);
  if(b.subscriptionEndsAt && st==='active') parts.push(`оплачено до ${formatBillingDate(b.subscriptionEndsAt)}`);
  if(b.balance<0) parts.push(`комиссия биржи: ${formatRub(-b.balance)}`);
  if(use.drivers>=lim.drivers || use.vehicles>=lim.vehicles) parts.push('лимит парка');
  if(st==='readonly' || st==='grace') parts.push('создание заказов ограничено');
  const et=billingCanUseEtrn(sid);
  if(et.ok && typeof epdSpaceForSpaceId==='function'){
    const epd=epdSpaceForSpaceId(sid);
    const epdLbl=typeof epdSpaceStatusLabel==='function'?epdSpaceStatusLabel(epd.status):'';
    parts.push(`ЭТrН Контур: ${epdLbl||'ждём boxId'}`);
  }
  return parts.join(' · ');
}

/** M3 stub: webhook ЮKassa / Тинькофф → обновление planId (см. docs/PAYMENT_INTEGRATION.md) */
function processPaymentWebhook(payload){
  if(typeof currentAdmin==='undefined' || !currentAdmin || !currentAdmin.isSuper){
    return {ok:false, error:'stub: только супер-админ до P1 server webhook'};
  }
  if(!payload||typeof payload!=='object') return {ok:false, error:'empty payload'};
  const spaceId=payload.spaceId || payload.metadata&&payload.metadata.spaceId;
  const amount=+(payload.amount||payload.object&&payload.object.amount&&payload.object.amount.value)||0;
  const provider=payload.provider || 'yukassa';
  if(!spaceId) return {ok:false, error:'spaceId required'};
  const b=getBillingForSpace(spaceId);
  const pay={
    id:payload.id||uuid(),
    amount:Math.round(amount),
    at:payload.at||new Date().toISOString(),
    note:`Автооплата (${provider})`,
    recordedBy:'webhook',
    provider
  };
  if(!(pay.amount>0)) return {ok:false, error:'amount required'};
  b.manualPayments=(b.manualPayments||[]).concat([pay]);
  b.balance=(Number(b.balance)||0)+pay.amount;
  b.lastPaymentAt=pay.at;
  b.paymentProvider=provider;
  b.ledger=(b.ledger||[]).concat([{
    id:uuid(), type:'payment_webhook', amount:pay.amount, at:pay.at, note:pay.note, paymentId:pay.id
  }]);
  if(payload.planId && BILLING_PLANS[payload.planId]) setSpaceBillingPlan(spaceId, payload.planId);
  const months=Math.max(1, Math.round(pay.amount/(billingPlan(b.planId).priceMonthly||2990)));
  const base=b.subscriptionEndsAt && new Date(b.subscriptionEndsAt).getTime()>Date.now()
    ? b.subscriptionEndsAt : new Date().toISOString();
  b.subscriptionEndsAt=addDaysIso(base, months*30);
  b.status='active';
  b.graceEndsAt=null;
  bumpDataEpoch('payment-webhook');
  return {ok:true, spaceId, amount:pay.amount, subscriptionEndsAt:b.subscriptionEndsAt};
}

if(typeof migrateBilling==='function') migrateBilling();

function billingSnapshotSlice(){
  migrateBilling();
  return {spaces:structuredClone(billingRoot().spaces)};
}

function applyBillingPayload(slice){
  if(!slice||typeof slice!=='object') return;
  billingRoot();
  if(slice.spaces&&typeof slice.spaces==='object'){
    state.billing.spaces=slice.spaces;
    migrateBilling();
  }
}
