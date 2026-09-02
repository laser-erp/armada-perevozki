/* АРМАДА — welcome wizard и пошаговые туры (онбординг) */
(function(){
  const KEYS={
    rolesWelcome:'armada_onboard_roles_welcome_v1',
    admin:'armada_onboard_admin_v1',
    driver:'armada_onboard_driver_v1',
    customer:'armada_onboard_customer_v1'
  };

  function done(key){ try{ return localStorage.getItem(key)==='1'; }catch(_){ return false; } }
  function mark(key){ try{ localStorage.setItem(key,'1'); }catch(_){} }

  function esc(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function isMobile(){ return window.matchMedia && window.matchMedia('(max-width:799px)').matches; }

  let overlayEl=null;
  let tooltipEl=null;
  let tourKey='';
  let steps=[];
  let stepIdx=0;
  let welcomeEl=null;

  function clearHighlights(){
    document.querySelectorAll('.onboard-highlight').forEach(el=>el.classList.remove('onboard-highlight'));
  }

  function destroyTour(){
    clearHighlights();
    if(overlayEl){ overlayEl.remove(); overlayEl=null; }
    if(tooltipEl){ tooltipEl.remove(); tooltipEl=null; }
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    if(!welcomeEl) document.body.classList.remove('onboard-active');
  }

  function resolveTarget(step){
    if(!step || !step.target) return null;
    if(typeof step.target==='function') return step.target()||null;
    const el=document.getElementById(step.target);
    return el||null;
  }

  function positionTooltip(target, placement){
    if(!tooltipEl) return;
    const margin=12;
    const pad=8;
    const vw=window.innerWidth;
    const vh=window.innerHeight;
    tooltipEl.style.maxWidth='min(360px, calc(100vw - 24px))';
    tooltipEl.style.left='';
    tooltipEl.style.right='';
    tooltipEl.style.top='';
    tooltipEl.style.bottom='';
    tooltipEl.style.transform='';

    if(!target){
      tooltipEl.classList.add('centered');
      return;
    }
    tooltipEl.classList.remove('centered');
    const r=target.getBoundingClientRect();
    const th=tooltipEl.offsetHeight||200;
    const tw=tooltipEl.offsetWidth||320;
    let top;
    let left;
    const place=placement||'bottom';
    if(place==='top'){
      top=r.top-margin-th;
      left=r.left+(r.width/2)-(tw/2);
    } else if(place==='left'){
      top=r.top+(r.height/2)-(th/2);
      left=r.left-margin-tw;
    } else if(place==='right'){
      top=r.top+(r.height/2)-(th/2);
      left=r.right+margin;
    } else {
      top=r.bottom+margin;
      left=r.left+(r.width/2)-(tw/2);
    }
    left=Math.max(pad, Math.min(left, vw-tw-pad));
    top=Math.max(pad, Math.min(top, vh-th-pad));
    tooltipEl.style.left=left+'px';
    tooltipEl.style.top=top+'px';
  }

  function renderTooltip(){
    if(!tooltipEl) return;
    const step=steps[stepIdx];
    const isLast=stepIdx>=steps.length-1;
    const isFirst=stepIdx===0;
    tooltipEl.innerHTML=`
      <div class="onboard-tooltip-inner">
        <div class="onboard-meta">${stepIdx+1} из ${steps.length}</div>
        <h3 class="onboard-title">${esc(step.title)}</h3>
        <div class="onboard-body">${step.body}</div>
        <div class="onboard-actions">
          <button type="button" class="onboard-skip ghost">Пропустить</button>
          <div class="onboard-nav">
            ${!isFirst?'<button type="button" class="onboard-prev secondary">Назад</button>':''}
            <button type="button" class="onboard-next primary">${isLast?'Готово':'Далее'}</button>
          </div>
        </div>
      </div>`;
    tooltipEl.querySelector('.onboard-skip').onclick=endTour;
    const prev=tooltipEl.querySelector('.onboard-prev');
    if(prev) prev.onclick=()=>{ stepIdx--; runStep(); };
    tooltipEl.querySelector('.onboard-next').onclick=()=>{
      if(isLast) endTour();
      else { stepIdx++; runStep(); }
    };
  }

  function reposition(){
    if(!tooltipEl) return;
    const step=steps[stepIdx];
    const target=resolveTarget(step);
    clearHighlights();
    if(target){
      target.classList.add('onboard-highlight');
      positionTooltip(target, step.placement);
    } else {
      positionTooltip(null);
    }
    renderTooltip();
    requestAnimationFrame(()=>{
      const t=resolveTarget(step);
      if(t) positionTooltip(t, step.placement);
    });
  }

  function runStep(){
    while(stepIdx<steps.length && steps[stepIdx].skipIf && steps[stepIdx].skipIf()) stepIdx++;
    if(stepIdx>=steps.length){ endTour(); return; }
    const step=steps[stepIdx];
    if(step && step.onEnter) try{ step.onEnter(); }catch(_){}
    if(!overlayEl){
      overlayEl=document.createElement('div');
      overlayEl.className='onboard-overlay';
      document.body.appendChild(overlayEl);
    }
    if(!tooltipEl){
      tooltipEl=document.createElement('div');
      tooltipEl.className='onboard-tooltip';
      tooltipEl.setAttribute('role','dialog');
      tooltipEl.setAttribute('aria-modal','true');
      document.body.appendChild(tooltipEl);
      window.addEventListener('resize', reposition);
      window.addEventListener('scroll', reposition, true);
    }
    reposition();
  }

  function endTour(){
    if(tourKey) mark(tourKey);
    destroyTour();
  }

  function startTour(key, tourSteps, opts){
    if(!tourSteps || !tourSteps.length) return;
    if(!opts || !opts.force){
      if(done(key)) return;
    }
    destroyWelcome();
    tourKey=key;
    steps=tourSteps;
    stepIdx=0;
    document.body.classList.add('onboard-active');
    runStep();
  }

  const ROLES_WELCOME=[
    {
      title:'Добро пожаловать в АРМАДА',
      body:'<p>Сервис для учёта перевозок: заказы, смены водителей, <strong>ЕТО</strong> (ежедневный техосмотр), биржа заявок и финансы.</p><p>Работает в браузере на телефоне и на компьютере.</p>'
    },
    {
      title:'Три роли входа',
      body:'<p><strong>Водитель</strong> — открыть смену, пройти ЕТО, вести заказы в дороге.</p><p><strong>Администратор</strong> — создавать заявки, биржа, справочники (авто, водители, тарифы).</p><p><strong>Заказчик</strong> — отправить свою заявку и видеть расчёт минимальной цены.</p>'
    },
    {
      title:'Синхронизация и офлайн',
      body:'<p>Данные сохраняются в браузере и на сервере. Если сеть пропала, водитель может продолжить — при появлении связи всё отправится.</p><p>На экране входа при проблемах с сервером появится подсказка «Нет связи».</p>'
    },
    {
      title:'Как начать',
      body:'<p>1. Откройте свою страницу входа: <strong>водитель</strong>, <strong>администратор</strong> или <strong>заказчик</strong> (ссылки на экране выбора роли).</p><p>2. PIN выдаёт администратор перевозчика.</p><p>3. Полная инструкция — <a href="help.html" target="_blank" rel="noopener">на странице «Помощь»</a>.</p>'
    }
  ];

  function destroyWelcome(){
    if(welcomeEl){ welcomeEl.remove(); welcomeEl=null; }
    if(!tooltipEl && !overlayEl) document.body.classList.remove('onboard-active');
  }

  function showRolesWelcome(){
    if(done(KEYS.rolesWelcome)) return;
    if(welcomeEl) return;
    let idx=0;
    welcomeEl=document.createElement('div');
    welcomeEl.className='onboard-welcome';
    welcomeEl.setAttribute('role','dialog');
    welcomeEl.setAttribute('aria-modal','true');
    document.body.appendChild(welcomeEl);
    document.body.classList.add('onboard-active');

    function paint(){
      const slide=ROLES_WELCOME[idx];
      const isLast=idx>=ROLES_WELCOME.length-1;
      welcomeEl.innerHTML=`
        <div class="onboard-welcome-card">
          <div class="onboard-welcome-brand">
            <img src="logo.png" alt="" width="48" height="48" />
            <span>АРМАДА</span>
          </div>
          <div class="onboard-meta">${idx+1} из ${ROLES_WELCOME.length}</div>
          <h2>${esc(slide.title)}</h2>
          <div class="onboard-welcome-body">${slide.body}</div>
          <div class="onboard-welcome-dots">${ROLES_WELCOME.map((_,i)=>`<span class="${i===idx?'on':''}"></span>`).join('')}</div>
          <div class="onboard-welcome-actions">
            <button type="button" class="ghost onboard-welcome-skip">Пропустить</button>
            <div class="onboard-nav">
              ${idx>0?'<button type="button" class="secondary onboard-welcome-prev">Назад</button>':''}
              <button type="button" class="primary onboard-welcome-next">${isLast?'Выбрать роль':'Далее'}</button>
            </div>
          </div>
          <p class="hint onboard-welcome-foot"><a href="help.html" target="_blank" rel="noopener">Полная инструкция</a> · <a href="kp.html">О пилоте</a></p>
        </div>`;
      welcomeEl.querySelector('.onboard-welcome-skip').onclick=()=>{
        mark(KEYS.rolesWelcome);
        destroyWelcome();
      };
      const prev=welcomeEl.querySelector('.onboard-welcome-prev');
      if(prev) prev.onclick=()=>{ idx--; paint(); };
      welcomeEl.querySelector('.onboard-welcome-next').onclick=()=>{
        if(isLast){
          mark(KEYS.rolesWelcome);
          destroyWelcome();
        } else { idx++; paint(); }
      };
    }
    paint();
  }

  const TOURS={
    admin:[
      {
        title:'Меню админки',
        body:'<p>Откройте меню ☰ — там разделы, помощь и выход.</p>',
        target:'admin-menu-toggle',
        placement:'bottom',
        skipIf:()=>!isMobile()
      },
      {
        title:'Разделы',
        body:'<p><strong>Парк</strong> — свои заказы и машины. <strong>ЕТО</strong> — техосмотры по авто.</p><p>Кнопка <strong>Биржа</strong> появляется, если в справочнике включён <strong>Диспетчер</strong> (логист и диспетчер — одна должность). Биржа — в тарифе «Бизнес». <strong>Справочники</strong> — водители, авто, компании, тарифы.</p>',
        target:()=>document.querySelector('.admin-sidebar-nav'),
        placement:'right',
        onEnter(){
          if(isMobile() && typeof openAdminSidebar==='function'){
            const sb=document.getElementById('admin-sidebar');
            if(sb && !sb.classList.contains('open')) openAdminSidebar();
          }
        }
      },
      {
        title:'Новый заказ',
        body:'<p>Кнопка <strong>+ Заказ</strong> — создать заявку: заказчик, маршрут, цены. Кто везёт — <strong>Парк</strong>; кнопка <strong>Биржа</strong> есть, если включён диспетчер (тариф «Бизнес»).</p>',
        target:'admin-new',
        placement:'bottom',
        onEnter(){
          if(isMobile() && typeof closeAdminSidebar==='function') closeAdminSidebar();
        }
      },
      {
        title:'Фильтры списка',
        body:'<p>Отфильтруйте парк: все, входящие от заказчика, назначенные, в работе, закрытые. Ниже — фильтр по фирме (если несколько парков).</p>',
        target:'admin-filters',
        placement:'bottom'
      },
      {
        title:'Справочники',
        body:'<p>Здесь настраивается всё для работы: водители и PIN, автомобили, компании, тариф ₽/км и ₽/ч, портал заказчика.</p><p>Тур можно перезапустить: «Помощь» в меню.</p>',
        target:'admin-catalogs',
        placement:'right',
        onEnter(){
          if(isMobile() && typeof openAdminSidebar==='function'){
            const sb=document.getElementById('admin-sidebar');
            if(sb && !sb.classList.contains('open')) openAdminSidebar();
          }
        }
      }
    ],
    driver:[
      {
        title:'Главная',
        body:'<p>Сводка дня: активные заказы, километры и статус смены.</p><p>Здесь же баннеры — напоминания «Выехал» / «Прибыл» и связь с сервером.</p>',
        target:'btn-home',
        placement:'top'
      },
      {
        title:'Смена и ЕТО',
        body:'<p>Нажмите <strong>«Открыть смену»</strong> внизу — выберите авто, одометр, уровни жидкостей и свет.</p><p>Без открытой смены заказы в работу не берутся.</p>',
        target:()=>document.getElementById('input-bar')||document.getElementById('driver-home'),
        placement:'top'
      },
      {
        title:'Заявки',
        body:'<p>Все ваши заказы: выехал, прибыл, одометры, маршрут. Карточка заказа — действия по шагам.</p>',
        target:'btn-orders',
        placement:'top'
      },
      {
        title:'История смен',
        body:'<p>Закрытые смены: дата, авто, пробег, заказы в смене.</p>',
        target:'btn-shifts',
        placement:'top'
      },
      {
        title:'Профиль',
        body:'<p>Начисления и ожидающие расчёта суммы, уведомления, выход.</p><p>Подсказки и полная инструкция — в профиле или на <a href="help.html" target="_blank" rel="noopener">странице помощи</a>.</p>',
        target:'btn-cabinet',
        placement:'top'
      }
    ],
    customer:[
      {
        title:'Новая заявка',
        body:'<p>Укажите адреса загрузки и выгрузки, дату подачи ТС, тоннаж и ориентиры км/часов — для расчёта минимальной цены.</p>',
        target:()=>document.querySelector('#customer-portal .form-section'),
        placement:'bottom'
      },
      {
        title:'Расчёт цены',
        body:'<p>Здесь появится <strong>минимальная цена</strong> по тарифу перевозчика. Вашу цену можно поднять, но не ниже минимума.</p>',
        target:'cust-price-preview',
        placement:'bottom'
      },
      {
        title:'Отправка на биржу',
        body:'<p>После отправки заявка попадёт в админку перевозчика и на биржу — диспетчер назначит машину или другая фирма заберёт заказ.</p>',
        target:'cust-submit',
        placement:'top'
      },
      {
        title:'Мои заявки',
        body:'<p>Статусы: на бирже, назначен, в работе, закрыт. История ваших отправок.</p><p>Инструкция: <a href="help.html" target="_blank" rel="noopener">Помощь</a>.</p>',
        target:'cust-orders-list',
        placement:'top'
      }
    ]
  };

  function maybeAdmin(){ setTimeout(()=>startTour(KEYS.admin, TOURS.admin), 450); }
  function maybeDriver(){ setTimeout(()=>startTour(KEYS.driver, TOURS.driver), 550); }
  function maybeCustomer(){ setTimeout(()=>startTour(KEYS.customer, TOURS.customer), 400); }

  function replay(which){
    const map={admin:KEYS.admin, driver:KEYS.driver, customer:KEYS.customer};
    const key=map[which];
    if(!key || !TOURS[which]) return;
    startTour(key, TOURS[which], {force:true});
  }

  function openHelp(){ window.open('help.html','_blank','noopener'); }

  window.ArmadaOnboarding={
    showRolesWelcome,
    maybeAdmin,
    maybeDriver,
    maybeCustomer,
    replay,
    openHelp,
    resetAll(){
      Object.values(KEYS).forEach(k=>{ try{ localStorage.removeItem(k); }catch(_){} });
    }
  };
})();
