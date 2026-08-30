/** Счета заказчику: создание, QR (СБП ST00012), скачивание HTML/PDF-ready. */
function normalizeCompanyBank(b){
  const raw=b||{};
  return {
    bankName:String(raw.bankName||'').trim(),
    bankBik:String(raw.bankBik||'').replace(/\D/g,'').trim(),
    bankAccount:String(raw.bankAccount||'').replace(/\D/g,'').trim(),
    bankCorrAccount:String(raw.bankCorrAccount||'').replace(/\D/g,'').trim()
  };
}
function companyBankDetails(co){
  if(!co) return normalizeCompanyBank({});
  if(co.bank) return normalizeCompanyBank(co.bank);
  return normalizeCompanyBank(co);
}
function companyHasBankForQr(bank){
  const b=normalizeCompanyBank(bank);
  return !!(b.bankAccount && b.bankBik);
}
function invoiceAmountForOrder(order){
  const n=+(order&&(order.priceForClient||order.freight||order.rateCash||order.rateWithoutVat||order.rateWithVat)||0);
  return n>0?Math.round(n):0;
}
function buildSbpQrPayload(carrier, order, amountRub){
  const b=companyBankDetails(carrier);
  if(!b.bankAccount||!b.bankBik) return null;
  const sumKop=Math.max(0, Math.round(+amountRub*100));
  const parts=[
    'ST00012',
    `Name=${carrier.name||'Получатель'}`,
    `PersonalAcc=${b.bankAccount}`,
    b.bankName?`BankName=${b.bankName}`:null,
    `BIC=${b.bankBik}`,
    b.bankCorrAccount?`CorrespAcc=${b.bankCorrAccount}`:null,
    carrier.inn?`PayeeINN=${String(carrier.inn).replace(/\D/g,'')}`:null,
    sumKop>0?`Sum=${sumKop}`:null,
    `Purpose=${encodeSbpField(`Оплата перевозки №${order.sequentialNumber||'—'}`)}`
  ].filter(Boolean);
  return parts.join('|');
}
function encodeSbpField(s){
  return String(s||'').replace(/\|/g,' ');
}
function buildFallbackQrPayload(carrier, order, amountRub){
  const lines=[
    carrier.name||'Перевозчик',
    carrier.inn?`ИНН ${carrier.inn}`:'',
    amountRub>0?`Сумма: ${fmt(amountRub)} ₽`:'Сумма: уточняется',
    `Назначение: оплата перевозки №${order.sequentialNumber||'—'}`,
    typeof routeText==='function'?routeText(order):''
  ].filter(Boolean);
  return lines.join('\n');
}
function invoiceQrPayload(carrier, order, amountRub){
  const sbp=buildSbpQrPayload(carrier, order, amountRub);
  if(sbp) return {text:sbp, kind:'sbp'};
  return {text:buildFallbackQrPayload(carrier, order, amountRub), kind:'text'};
}
function drawInvoiceQrCanvas(text, size){
  const qr=typeof qrcode==='function'?qrcode(0,'M'):null;
  if(!qr||!text) return null;
  qr.addData(String(text));
  qr.make();
  const n=qr.getModuleCount();
  const cell=Math.max(2, Math.floor((size||180)/n));
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=n*cell;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#000';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++){
    if(qr.isDark(r,c)) ctx.fillRect(c*cell,r*cell,cell,cell);
  }
  return canvas;
}
function ensureInvoicesRoot(){
  if(!Array.isArray(state.invoices)) state.invoices=[];
  return state.invoices;
}
function findInvoiceById(id){
  return ensureInvoicesRoot().find(x=>x.id===id)||null;
}
function findInvoiceByOrderId(orderId){
  return ensureInvoicesRoot().find(x=>x.orderId===orderId)||null;
}
function customerInvoicesForPortal(customerId){
  if(!customerId) return [];
  return ensureInvoicesRoot()
    .filter(x=>x.customerId===customerId)
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
function createCustomerInvoiceForOrder(order, customerCo, carrierCo){
  if(!order||!order.id) return null;
  const existing=findInvoiceByOrderId(order.id);
  if(existing) return existing;
  const amount=invoiceAmountForOrder(order);
  const inv={
    id:uuid(),
    number:`${order.sequentialNumber||'—'}`,
    orderId:order.id,
    orderSeq:order.sequentialNumber||null,
    customerId:order.customerId||customerCo&&customerCo.id||null,
    customerName:order.customer||customerCo&&customerCo.name||'',
    spaceId:order.spaceId||null,
    carrierId:order.ownCompanyId||carrierCo&&carrierCo.id||null,
    carrierName:order.ownCompanyName||carrierCo&&carrierCo.name||'',
    amount,
    pricePending:!!order.pricePending,
    route:typeof routeText==='function'?routeText(order):'',
    createdAt:new Date().toISOString()
  };
  ensureInvoicesRoot().push(inv);
  bumpDataEpoch('customer-invoice');
  return inv;
}
function customerInvoiceHtml(invoice){
  const order=(state.orders||[]).find(o=>o.id===invoice.orderId)||{};
  const carrier=findCompanyById(invoice.carrierId||order.ownCompanyId)||null;
  const customer=findCompanyById(invoice.customerId||order.customerId)||null;
  const bank=companyBankDetails(carrier);
  const amount=invoice.amount||invoiceAmountForOrder(order);
  const qr=invoiceQrPayload(carrier||{}, order, amount);
  const qrCanvas=drawInvoiceQrCanvas(qr.text, 200);
  const qrDataUrl=qrCanvas?qrCanvas.toDataURL('image/png'):'';
  const amtLine=amount>0?`${fmt(amount)} ₽`:(invoice.pricePending?'уточняется перевозчиком':'—');
  const bankLines=[
    bank.bankName?`Банк: ${esc(bank.bankName)}`:null,
    bank.bankBik?`БИК: ${esc(bank.bankBik)}`:null,
    bank.bankAccount?`Р/с: ${esc(bank.bankAccount)}`:null,
    bank.bankCorrAccount?`К/с: ${esc(bank.bankCorrAccount)}`:null
  ].filter(Boolean).join('<br>');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<title>Счёт №${esc(invoice.number)}</title>
<style>
  body{font:14px/1.45 system-ui,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
  h1{font-size:1.25rem;margin:0 0 4px}
  .meta{color:#64748b;font-size:.85rem;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
  th{background:#f8fafc;width:38%}
  .sum{font-size:1.15rem;font-weight:800;margin:12px 0}
  .qr-wrap{text-align:center;margin:20px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px}
  .qr-wrap img{width:200px;height:200px}
  .hint{font-size:.78rem;color:#64748b;margin-top:8px}
  @media print{body{margin:0} .noprint{display:none}}
</style></head><body>
  <h1>Счёт на оплату №${esc(invoice.number)}</h1>
  <p class="meta">от ${esc(typeof formatRuDateTimeAt==='function'?formatRuDateTimeAt(invoice.createdAt):invoice.createdAt)} · АРМАДА</p>
  <table>
    <tr><th>Получатель</th><td>${esc(invoice.carrierName||carrier&&carrier.name||'—')}<br>${carrier&&carrier.inn?`ИНН ${esc(carrier.inn)}`:''}${carrier&&carrier.address?`<br>${esc(carrier.address)}`:''}</td></tr>
    <tr><th>Плательщик</th><td>${esc(invoice.customerName||customer&&customer.name||'—')}${customer&&customer.inn?`<br>ИНН ${esc(customer.inn)}`:''}</td></tr>
    <tr><th>Основание</th><td>Заявка на перевозку №${esc(invoice.orderSeq||invoice.number)}<br>${esc(invoice.route||routeText(order))}</td></tr>
    <tr><th>Назначение платежа</th><td>Оплата перевозки №${esc(invoice.orderSeq||invoice.number)}</td></tr>
  </table>
  <p class="sum">К оплате: ${amtLine}</p>
  ${bankLines?`<p>${bankLines}</p>`:'<p class="hint">Реквизиты банка не заполнены — укажите их в карточке «Наша фирма» в админке.</p>'}
  <div class="qr-wrap">
    ${qrDataUrl?`<img src="${qrDataUrl}" alt="QR для оплаты"/>`:'<p>QR недоступен</p>'}
    <p class="hint">${qr.kind==='sbp'?'QR по стандарту СБП (ST00012) — отсканируйте в приложении банка.':'QR с реквизитами платежа (заполните банк в админке для СБП).'}</p>
  </div>
  <p class="noprint hint"><button onclick="window.print()">Печать / PDF</button></p>
</body></html>`;
}
function downloadCustomerInvoice(invoiceId){
  const inv=findInvoiceById(invoiceId);
  if(!inv){ alert('Счёт не найден'); return; }
  const html=customerInvoiceHtml(inv);
  const blob=new Blob([html], {type:'text/html;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`schet-${inv.number||inv.id}.html`;
  a.rel='noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}
function customerInvoiceDocBody(invoice){
  const order=(state.orders||[]).find(o=>o.id===invoice.orderId)||{};
  const carrier=findCompanyById(invoice.carrierId||order.ownCompanyId)||null;
  const customer=findCompanyById(invoice.customerId||order.customerId)||null;
  const bank=companyBankDetails(carrier);
  const amount=invoice.amount||invoiceAmountForOrder(order);
  const amtLine=amount>0?`${fmt(amount)} ₽`:(invoice.pricePending?'уточняется перевозчиком':'—');
  const bankLines=[
    bank.bankName?`Банк: ${esc(bank.bankName)}`:null,
    bank.bankBik?`БИК: ${esc(bank.bankBik)}`:null,
    bank.bankAccount?`Р/с: ${esc(bank.bankAccount)}`:null,
    bank.bankCorrAccount?`К/с: ${esc(bank.bankCorrAccount)}`:null
  ].filter(Boolean).join('<br>');
  return `
    <div class="doc-head">
      <div class="brand">АРМАДА</div>
      <h1>Счёт на оплату №${esc(invoice.number)}</h1>
      <div class="muted">от ${esc(typeof formatRuDateTimeAt==='function'?formatRuDateTimeAt(invoice.createdAt):invoice.createdAt)}</div>
    </div>
    <table><thead><tr><th>Поле</th><th>Значение</th></tr></thead><tbody>
      <tr><td>Получатель</td><td>${esc(invoice.carrierName||carrier&&carrier.name||'—')}${carrier&&carrier.inn?`<br>ИНН ${esc(carrier.inn)}`:''}</td></tr>
      <tr><td>Плательщик</td><td>${esc(invoice.customerName||customer&&customer.name||'—')}${customer&&customer.inn?`<br>ИНН ${esc(customer.inn)}`:''}</td></tr>
      <tr><td>Основание</td><td>Заявка №${esc(invoice.orderSeq||invoice.number)} · ${esc(invoice.route||routeText(order))}</td></tr>
    </tbody></table>
    <p><strong>К оплате: ${amtLine}</strong></p>
    ${bankLines?`<p>${bankLines}</p>`:''}`;
}
function openCustomerInvoice(invoiceId){
  const inv=findInvoiceById(invoiceId);
  if(!inv){ alert('Счёт не найден'); return; }
  const w=window.open('', '_blank', 'noopener');
  if(!w){ downloadCustomerInvoice(invoiceId); return; }
  w.document.write(customerInvoiceHtml(inv));
  w.document.close();
}
