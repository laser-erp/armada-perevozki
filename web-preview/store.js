/* АРМАДА store: state / persist / PocketBase (phase2 chunk B) */
const DEFAULT_VEHICLES=[
  {plate:"О 535 МВ 198",consumptionPer100Km:20,payloadTons:5,bodyLengthM:6,bodyWidthM:2.4,bodyHeightM:2.2},
  {plate:"М 277 НО 198",consumptionPer100Km:20,payloadTons:5,bodyLengthM:6,bodyWidthM:2.4,bodyHeightM:2.2},
  {plate:"В 603 СА 47",consumptionPer100Km:20,payloadTons:10,bodyLengthM:8,bodyWidthM:2.45,bodyHeightM:2.5,makeModel:"ГАЗ 33104 Валдай"}
];
/** Регламент по руководству ГАЗ-33104 «Валдай» (ММЗ): ТО-1 10 тыс. км, ТО-2 20 тыс. км, СО раз в год. */
/** Современные аналоги (что брать в магазине) ↔ старые названия из руководства. */
const GAZ_33104_BUY={
  gear:"Лукойл ТМ-5 85W-90 API GL-5 или Газпромнефть Super T-3 / GL-5 80W-90; зимой — GL-5 75W-90",
  litol:"Литол-24 в тубе (Oilright, VMPAUTO, Газпромнефть) или любая литиевая NLGI-2",
  solidol:"Солидол Ж/С или тот же Литол-24 (NLGI-2)",
  shock:"АЖ-12Т (Oilright) или жидкость для амортизаторов",
  gur:"ATF Dexron II/III (Лукойл ATF, Mobil ATF 220); очень холодно — ВМГЗ",
  brake:"Тормозная DOT-4: РосДот-4, Felix DOT-4, Castrol DOT-4",
  cool:"ОЖ-40 / Тосол А-40М или готовый антифриз G11 (−40)",
  motor:"Дизель 15W-40 или 10W-40 API CI-4/CH-4/CF-4 (Лукойл, Газпромнефть, Shell Rimula)"
};
/** Табл. 2.4 — карта смазки: buy = что купить сегодня; grease = как в руководстве. */
const GAZ_33104_LUBE_TABLE=[
  {point:"Картер КПП", places:"1", amount:"по уровню", buy:GAZ_33104_BUY.gear, grease:"По руководству: «Супер Т-3», «Девон Супер Т», Лукойл ТМ-5 85W-90 (−25…+40 °C); зимой 75W-90"},
  {point:"Подшипники карданных шарниров", places:"3", amount:"~4 г", buy:GAZ_33104_BUY.gear, grease:"По руководству: «Супер Т-3» / Лукойл ТМ-5 85W-90"},
  {point:"Шлицы карданного вала", places:"1", amount:"200 г", buy:GAZ_33104_BUY.gear, grease:"По руководству: «Супер Т-3» / Лукойл ТМ-5 85W-90"},
  {point:"Подшипник промежуточной опоры кардана", places:"1", amount:"50 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24; дубль ЛИТА"},
  {point:"Подшипники шкворней", places:"4", amount:"30 г", buy:GAZ_33104_BUY.solidol, grease:"По руководству: солидол Ж или солидол С"},
  {point:"Картер заднего моста (+ ступицы задних)", places:"1", amount:"8 л", buy:GAZ_33104_BUY.gear, grease:"По руководству: «Супер Т-3» / Лукойл ТМ-5 85W-90; зимой 75W-90"},
  {point:"Подшипники ступиц передних колёс", places:"4", amount:"400±30 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24; дубль ЛИТА"},
  {point:"Манжеты ступиц задних колёс", places:"2", amount:"40 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24"},
  {point:"Амортизаторы", places:"4", amount:"550±5 см³", buy:GAZ_33104_BUY.shock, grease:"По руководству: АЖ-12Т; дубль — веретенное АУ"},
  {point:"Система ГУР", places:"1", amount:"1,5 л", buy:GAZ_33104_BUY.gur, grease:"По руководству: гидромасло Р; ниже −35 °C — ВМГЗ"},
  {point:"Уплотнитель рулевого вала", places:"1", amount:"5 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24; дубль ЛИТА"},
  {point:"Карданные шарниры рулевого привода", places:"3", amount:"6 г", buy:GAZ_33104_BUY.litol, grease:"По руководству: Литол-24; дубль солидол С/Ж"},
  {point:"Гидропривод сцепления", places:"1", amount:"0,2 л", buy:GAZ_33104_BUY.brake, grease:"По руководству: «РОСДОТ»; дубль «Томь» III-А"}
];
const GAZ_33104_BUY_LIST=[
  {need:"КПП, мост, шлицы, шарниры кардана", buy:GAZ_33104_BUY.gear},
  {need:"Опора кардана, ступицы, рулевые шарниры", buy:GAZ_33104_BUY.litol},
  {need:"Шкворни", buy:GAZ_33104_BUY.solidol},
  {need:"ГУР", buy:GAZ_33104_BUY.gur},
  {need:"Сцепление (гидропривод)", buy:GAZ_33104_BUY.brake},
  {need:"Амортизаторы (при заправке)", buy:GAZ_33104_BUY.shock},
  {need:"Охлаждающая жидкость", buy:GAZ_33104_BUY.cool},
  {need:"Моторное масло + фильтр", buy:GAZ_33104_BUY.motor}
];
const GAZ_33104_TO1_WORKS=[
  {text:"Двигатель: проверить герметичность систем охлаждения, питания и смазки",
   how:"Осмотреть двигатель снизу и сверху на холодном и прогретом моторе.\nПодтекание охлаждающей жидкости, топлива и масла не допускается.\nПри подтёках — подтянуть хомуты/пробки или заменить уплотнения."},
  {text:"Проверить состояние шлангов топливопроводов",
   how:"Осмотреть все шланги топлива на трещины, вздутия, потёртости.\nТрещины на наружной поверхности не допускаются — шланг заменить."},
  {text:"Проверить крепление фланца приёмной трубы глушителя",
   how:"Проверить гайки/болты фланца приёмной трубы.\nОслабленное крепление подтянуть; при прогаре прокладки — заменить."},
  {text:"Проверить и отрегулировать натяжение ремней привода вспомогательных агрегатов",
   how:"Нажать на ветвь ремня посередине между шкивами.\nПрогиб должен соответствовать руководству (обычно ~10–15 мм при усилии ~40 Н).\nОслабить кронштейн/натяжитель, подтянуть ремень, зафиксировать, проверить снова."},
  {text:"Заменить масло в системе смазки двигателя и масляный фильтр",
   how:"Что купить: "+GAZ_33104_BUY.motor+".\nПрогреть двигатель, заглушить, подставить ёмкость.\nОткрутить сливную пробку картера, слить масло; завернуть пробку.\nСнять масляный фильтр, смазать резиновое кольцо нового, закрутить от руки + ¾ оборота.\nЗалить масло до метки «П» (между «П» и «0», ближе к «П»).\nЗапустить 1–2 мин, заглушить, проверить уровень и отсутствие течи."},
  {text:"При первых трёх ТО-1: проверить крепление головки блока и зазоры клапанов",
   how:"Только на первых трёх ТО-1 (на холодном двигателе).\nПроверить момент затяжки болтов/гаек ГБЦ по схеме руководства.\nПроверить зазоры клапанов щупом; при необходимости отрегулировать.\nНа последующих ТО-1 пункт можно пропустить (отметить как выполненный с пометкой)."},
  {text:"Ходовая: проверить крепление колёс и стремянок рессор",
   how:"Проверить затяжку гаек колёс крест-накрест.\nПроверить гайки стремянок рессор и крепление кронштейнов.\nОслабленное крепление подтянуть."},
  {text:"Тормоза: проверить герметичность и работу рабочей тормозной системы",
   how:"При работающем двигателе нажать педаль до упора — педаль не должна уходить в пол.\nПосле нажатия до упора падение давления в системе при заглушенном двигателе — не более 0,005 МПа за 15 мин.\nЗуммер низкого давления не должен гореть постоянно (кроме подкачки после пуска).\nСделать пробное торможение на малой скорости."},
  {text:"Тормоза: проверить состояние привода и работу стояночной тормозной системы",
   how:"Рукоятка (кран) стояночного тормоза должна свободно ходить и фиксироваться в «парковке».\nНа уклоне или на передаче убедиться, что стояночный тормоз удерживает автомобиль.\nПри необходимости подтянуть трос/привод."},
  {text:"Трансмиссия: смазать шлицы карданного вала (GL-5 85W-90, ~200 г)",
   how:"Что купить: "+GAZ_33104_BUY.gear+".\nНайти пресс-маслёнку на шлицевом соединении кардана.\nШприцем нагнетать до появления свежей смазки (~200 г). Вытереть излишки.\n(В руководстве: «Супер Т-3» / Лукойл ТМ-5.)"},
  {text:"Трансмиссия: смазать подшипник промежуточной опоры кардана (Литол-24, ~50 г)",
   how:"Что купить: "+GAZ_33104_BUY.litol+".\nНайти пресс-маслёнку на промежуточной опоре кардана.\nШприцем нагнетать до появления свежей смазки (~50 г).\nВытереть излишки, проверить, что опора не имеет люфта/шумов."}
];
const GAZ_33104_TO2_WORKS=[
  {text:"Все работы ТО-1",
   how:"Сначала полностью выполнить чек-лист ТО-1 (или открыть отдельную запись ТО-1).\nНиже — дополнительные работы только для ТО-2."},
  {text:"Двигатель: проверить подушки подвески двигателя",
   how:"Осмотреть передние и задние подушки двигателя.\nРасслоение, разрывы и попадание масла на подушки не допускаются — заменить."},
  {text:"Проверить дымность отработавших газов",
   how:"На прогретом двигателе в режиме свободного ускорения оценить дымность.\nСильный чёрный/сизый дым — диагностика ТНВД, фильтров, турбины (раздел 3 руководства)."},
  {text:"Проверить работу привода подачи топлива",
   how:"Проверить ход педали газа и тяг/троса привода ТНВД без заеданий.\nРычаг ТНВД должен доходить до упоров холостого хода и полной подачи."},
  {text:"Проверить крепления двигателя, вентилятора, шкива коленвала, радиатора",
   how:"Подтянуть ослабленные гайки/болты крепления двигателя к раме.\nПроверить крепление вентилятора, шкива коленвала и радиатора.\nОслабленное крепление подтянуть."},
  {text:"Проверить крепления шлангов воздушного фильтра / турбокомпрессора / охладителя наддува",
   how:"Проверить хомуты: воздушный фильтр → турбина → охладитель → впуск.\nПодтянуть ослабленные хомуты; порванные патрубки заменить.\nПодсос воздуха не допускается."},
  {text:"Проверить крепления газопроводов и турбокомпрессора",
   how:"Проверить болты/гайки крепления турбокомпрессора и газопроводов.\nОслабленное крепление подтянуть; при утечке газов — прокладки."},
  {text:"Проверить и отрегулировать зазоры клапанов (при необходимости)",
   how:"На холодном двигателе снять крышку клапанов.\nПроверить зазоры щупом по порядку цилиндров руководства.\nПри отклонении — отрегулировать и законтрить.\nПоставить крышку, проверить отсутствие течи масла."},
  {text:"Вымыть и протереть двигатель (при необходимости)",
   how:"Закрыть генератор и электроразъёмы.\nВымыть моторный отсек моющим средством, смыть, протереть.\nПосле мойки проверить уровни и отсутствие течей."},
  {text:"Очистить корпус воздушного фильтра; продуть или заменить фильтрующий элемент",
   how:"Снять крышку корпуса фильтра, вынуть элемент.\nПродуть элемент изнутри гофр, затем снаружи сжатым воздухом (не выше допуска).\nПри повреждении/замасливании — заменить.\nОчистить корпус, собрать, проверить плотность посадки."},
  {text:"Очистить корпус фильтра тонкой очистки топлива и заменить элемент",
   how:"Сбросить давление/перекрыть подачу при необходимости.\nСнять корпус фильтра тонкой очистки, заменить бумажный элемент.\nСобрать, прокачать топливо, убедиться в отсутствии подтёков."},
  {text:"Трансмиссия: проверить люфт карданной передачи; крепления КПП, фланцев, заднего моста",
   how:"Покачать кардан у шарниров и шлицев — люфт сверх нормы не допускается.\nПодтянуть крепления картера сцепления/КПП, фланцев карданов, промежуточной опоры.\nОбойма сальников шлицев — до совмещения переднего торца с канавкой втулки.\nПодтянуть фланец и муфту ведущей шестерни заднего моста."},
  {text:"Очистить сапуны КПП и заднего моста",
   how:"Снять/прочистить сапуны КПП и заднего моста от грязи.\nПроверить, что канал сапуна не забит — иначе выдавливает масло через уплотнения."},
  {text:"Заменить масло в КПП и заднем мосту (GL-5 85W-90; зимой 75W-90)",
   how:"Что купить: "+GAZ_33104_BUY.gear+" (~8 л на мост + КПП по уровню).\nСразу после поездки (масло тёплое) подставить ёмкость.\nОткрутить сливные пробки КПП и моста, слить масло, завернуть пробки.\nЗалить до нижней кромки наливного отверстия. Завернуть пробки, проверить течи.\n(В руководстве: «Супер Т-3» / Лукойл ТМ-5.)"},
  {text:"Смазать подшипники карданных шарниров и шлицы (GL-5); опору — Литол-24",
   how:"Что купить: трансмиссия — "+GAZ_33104_BUY.gear+"; опора — "+GAZ_33104_BUY.litol+".\nЧерез пресс-маслёнки нагнетать до появления свежей смазки:\n• шарниры и шлицы кардана — GL-5 (~200 г на шлицы);\n• промежуточная опора — Литол-24 (~50 г).\nВытереть излишки."},
  {text:"Ходовая: проверить амортизаторы, полуоси, буксирное устройство",
   how:"Проверить крепление амортизаторов и кронштейнов, подтянуть.\nПроверить крепление полуосей и буксирного устройства к раме.\nТечи амортизаторов / сорванные крепления — заменить или ремонтировать."},
  {text:"Проверить/отрегулировать схождение передних колёс; состояние шин и дисков",
   how:"На ровной площадке проверить схождение (норма 2–4 мм по руководству).\nОсмотреть шины: гвозди, порезы, неравномерный износ; давление — по норме на холодных.\nНа ободьях не должно быть вмятин."},
  {text:"Обслуживание ступиц колёс: очистка, подшипники, Литол-24, регулировка",
   how:"Что купить: "+GAZ_33104_BUY.litol+".\nСнять колпак/ступицу, очистить от старой смазки.\nПроверить подшипники, шейки цапф и сальники — износ/выкрашивание не допускаются.\nЗаложить смазку (передние ступицы ~400±30 г на точку; манжеты задних — ~40 г).\nСобрать и отрегулировать подшипники по руководству (раздел 5)."},
  {text:"При необходимости отбалансировать и переставить колёса",
   how:"При вибрации на скорости — балансировка колёс.\nПо схеме перестановки поменять местами колёса для равномерного износа."},
  {text:"Рулевое: герметичность ГУР (ATF Dexron), люфты, крепления механизма и колонки",
   how:"Что купить / долить: "+GAZ_33104_BUY.gur+".\nУровень в бачке ГУР — между MIN и MAX. Подтекание не допускается.\n(В руководстве: гидромасло Р; ниже −35 °C — ВМГЗ.)\nЛюфт руля по ободу — не более нормы; люфт шарниров колонки — заменить изношенное.\nПодтянуть крепления картера рулевого механизма, сошки, клиньев, колонки и руля."},
  {text:"Тормоза: крепление крана, трубопроводов, баллонов; колодки и диски",
   how:"Подтянуть крепление тормозного крана, трубопроводов и воздушных баллонов.\nОсмотреть колодки и диски/барабаны на износ и трещины.\nПри необходимости заменить фрикционные накладки."},
  {text:"Проверить/отрегулировать регулятор давления воздуха; при конденсате — картридж осушителя",
   how:"Проверить срабатывание регулятора давления по манометру (в диапазоне руководства).\nСлить конденсат из баллонов; при обильном конденсате/масле — заменить картридж осушителя."},
  {text:"Электрооборудование: фары, АКБ (очистка, крепление, уровень электролита), генератор и стартер",
   how:"Проверить работу фар, сигналов, стеклоочистителя и приборов.\nАКБ: очистить клеммы, смазать ПВК/солидолом, подтянуть крепление; уровень электролита — между метками.\nПроверить крепление и работу генератора и стартера, натяжение ремня генератора."},
  {text:"Проверить крепление кабины, оперения, зеркал; состояние ЛКП кабины",
   how:"Подтянуть крепления кабины, крыльев, капота, зеркал.\nОсмотреть ЛКП: сколы до металла — зачистить и подкрасить, чтобы не ржавело."}
];
const GAZ_33104_SO_WORKS=[
  {text:"Выполняется раз в год вместе с очередным ТО-1 или ТО-2",
   how:"Делать осенью (перед зимой) совместно с ближайшим ТО-1 или ТО-2.\nПункты ниже — дополнительно к выбранному ТО."},
  {text:"Проверить плотность охлаждающей жидкости (осенью)",
   how:"Что купить при замене: "+GAZ_33104_BUY.cool+".\nНа холодном двигателе взять пробу из расширительного бачка.\nПлотность при 20 °C должна быть 1,075–1,085 г/см³.\nПри меньшей плотности — заменить или довести концентрат."},
  {text:"Очистить/промыть фильтр грубой очистки топлива (осенью)",
   how:"Снять корпус фильтра-отстойника грубой очистки.\nПромыть фильтрующий элемент, очистить корпус.\nСобрать, убедиться в отсутствии подтёков топлива."},
  {text:"Слить отстой из топливного бака и фильтров (осенью)",
   how:"Слить отстой из топливного бака, корпуса фильтра-отстойника и фильтра тонкой очистки.\nПосле слива проверить герметичность пробок и корпусов — подтёков быть не должно."},
  {text:"Проверить плотность электролита АКБ (осенью)",
   how:"Ареометром проверить плотность электролита по банкам.\nПри низкой плотности — зарядка; при необходимости довести уровень дистиллированной водой.\nКлеммы очистить и смазать."},
  {text:"Смазать карданные шарниры рулевого управления и уплотнитель рулевого вала (Литол-24)",
   how:"Что купить: "+GAZ_33104_BUY.litol+".\nЧерез пресс-маслёнки шарниров рулевого привода нагнетать до появления свежей смазки (~6 г на 3 точки).\nСдвинуть кромку уплотнителя рулевого вала и смазать рабочую поверхность вала (~5 г)."}
];
const GAZ_33104_SERVICE_INTERVALS=[
  {name:"ТО-1 (ГАЗ 33104)", everyKm:10000, everyMonths:12, note:"По руководству ГАЗ-33104: каждые 10 000 км или раз в год. У каждого пункта — как делать.", works:GAZ_33104_TO1_WORKS},
  {name:"ТО-2 (ГАЗ 33104)", everyKm:20000, everyMonths:12, note:"По руководству ГАЗ-33104: каждые 20 000 км (включает ТО-1 + расширенный объём).", works:GAZ_33104_TO2_WORKS},
  {name:"СО — сезонное ТО", everyKm:null, everyMonths:12, note:"Сезонное обслуживание раз в год, совместно с ТО-1 или ТО-2.", works:GAZ_33104_SO_WORKS}
];
function isGaz33104Valdai(v){
  if(!v) return false;
  return normPlateKey(v.plate)===normPlateKey('В 603 СА 47')
    || /33104|валдай/i.test(v.makeModel||'');
}
function gaz33104LubeTableHtml(){
  return `<details style="margin-top:10px" open>
    <summary style="cursor:pointer;color:var(--accent);font-weight:700;font-size:.82rem">Таблица смазки — что купить сегодня</summary>
    <div class="svc-buy-list">
      <strong>Список в магазин (современные аналоги)</strong>
      <ul>${GAZ_33104_BUY_LIST.map(x=>`<li><b>${esc(x.need)}:</b> ${esc(x.buy)}</li>`).join('')}</ul>
    </div>
    <div style="overflow-x:auto;margin-top:8px">
      <table class="svc-lube">
        <thead><tr><th>Узел</th><th>Точ. / объём</th><th>Что купить / лить</th></tr></thead>
        <tbody>
          ${GAZ_33104_LUBE_TABLE.map(r=>`<tr>
            <td>${esc(r.point)}</td>
            <td>${esc(r.places)} · ${esc(r.amount)}</td>
            <td><div class="buy">${esc(r.buy||r.grease)}</div>${r.grease?`<div class="old">${esc(r.grease)}</div>`:''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="meta" style="margin-top:4px">Через пресс-маслёнки — до появления свежей смазки. Серым — название из руководства ГАЗ-33104 (табл. 2.4).</div>
  </details>`;
}
const DEFAULT_DRIVERS=[
  {name:"Наволоцкий Е.Н.",salaryPercent:30,exchangeEnabled:false,phone:""},
  {name:"Нечаев А.С.",salaryPercent:30,exchangeEnabled:false,phone:""}
];
const FLUIDS=["Максимум","Середина","Минимум"];
/** Активный водитель сессии (выбирается на экране «Водитель»). */
let DRIVER="";
let DRIVER_COMPANY_ID=null;
const DRIVER_SESSION_KEY="armada_driver_session_v1";
/** Слабые PIN из истории репо — при входе требуем смену (P0.1 compliance). */
const WEAK_ADMIN_PINS=new Set(["2580","45680","1234","0000"]);
const SUPER_ADMIN_RECOVERY_PIN='45680';
function generateAdminPin(){
  let s="";
  for(let i=0;i<6;i++) s+=String(Math.floor(Math.random()*10));
  return s;
}
const APP_BUILD="2026-08-27-entrybc3";
const ENTRY_MODES=['driver','admin','customer'];
const ENTRY_SESSION_KEY='armada_entry_mode_v1';
function normalizeEntryMode(v){
  const x=String(v||'').trim().toLowerCase();
  return ENTRY_MODES.includes(x)?x:null;
}
function readEntryFromUrl(){
  try{
    const q=new URLSearchParams(location.search||'');
    const fromQ=normalizeEntryMode(q.get('entry'));
    if(fromQ) return fromQ;
    const path=(location.pathname||'').toLowerCase();
    if(/driver\.html$/i.test(path)||/\/v\/?$/.test(path)) return 'driver';
    if(/admin\.html$/i.test(path)||/\/a\/?$/.test(path)) return 'admin';
    if(/zakaz\.html$/i.test(path)||/\/z(\/|$)/.test(path)) return 'customer';
  }catch(_){}
  return null;
}
function setEntryMode(mode){
  const m=normalizeEntryMode(mode);
  try{
    if(m) sessionStorage.setItem(ENTRY_SESSION_KEY,m);
    else sessionStorage.removeItem(ENTRY_SESSION_KEY);
  }catch(_){}
}
function getEntryMode(){
  try{
    const fromUrl=readEntryFromUrl();
    if(fromUrl){
      setEntryMode(fromUrl);
      return fromUrl;
    }
    return normalizeEntryMode(sessionStorage.getItem(ENTRY_SESSION_KEY));
  }catch(_){ return null; }
}
function initEntryFromPage(){
  const fromUrl=readEntryFromUrl();
  if(fromUrl) setEntryMode(fromUrl);
  else if(!getEntryMode()){
    const path=(location.pathname||'').toLowerCase();
    if((/index\.html$/.test(path)||path==='/'||path.endsWith('/'))
      && !/\/[avz]\/?$/i.test(path)){
      setEntryMode('admin');
    }
  }
}
function entryLoginScreenId(){
  const m=getEntryMode();
  if(m==='driver') return 'driver-login';
  if(m==='admin') return 'admin-pin';
  if(m==='customer') return 'customer-login';
  return 'roles';
}
function entryLandingPage(mode){
  const m=normalizeEntryMode(mode)||getEntryMode();
  const origin=(typeof location!=='undefined'&&location.origin)?location.origin:'';
  if(m==='driver') return `${origin}/v`;
  if(m==='admin') return `${origin}/a`;
  if(m==='customer'){
    const sc=getPortalScope();
    if(sc&&sc.portalSlug) return `${origin}/z/${sc.portalSlug}`;
    if(sc&&sc.spaceId){
      const sp=findSpaceById(sc.spaceId);
      if(sp&&sp.portalSlug) return `${origin}/z/${sp.portalSlug}`;
    }
    return `${origin}/z`;
  }
  return `${origin}/a`;
}
function customerPortalPageUrl(opts){
  try{
    const o=opts&&typeof opts==='object'?opts:{};
    const origin=location.origin;
    if(o.companyId) return `${origin}/z?c=${encodeURIComponent(o.companyId)}`;
    let spaceId=o.spaceId;
    if(!spaceId && typeof currentSpaceId==='function') spaceId=currentSpaceId();
    if(spaceId){
      const sp=findSpaceById(spaceId);
      if(sp&&sp.portalSlug) return `${origin}/z/${encodeURIComponent(sp.portalSlug)}`;
    }
    return `${origin}/z`;
  }catch(_){
    return `${location.origin}/z`;
  }
}
const PORTAL_SCOPE_KEY='armada_portal_scope_v1';
function readPortalScopeFromUrl(){
  try{
    const path=(location.pathname||'').toLowerCase();
    const slugM=path.match(/\/z\/([a-z0-9][a-z0-9_-]{2,31})\/?$/i);
    if(slugM) return {portalSlug:slugM[1].toLowerCase()};
    const q=new URLSearchParams(location.search||'');
    const companyId=String(q.get('c')||q.get('company')||'').trim();
    const spaceId=String(q.get('s')||q.get('space')||'').trim();
    if(companyId) return {companyId};
    if(spaceId) return {spaceId};
  }catch(_){}
  return null;
}
function resolvePortalScope(scope){
  const sc=scope||getPortalScope();
  if(!sc) return null;
  if(sc.companyId||sc.spaceId) return sc;
  if(sc.portalSlug){
    const sp=findSpaceByPortalSlug(sc.portalSlug);
    if(sp) return {spaceId:sp.id, portalSlug:sp.portalSlug};
  }
  return sc;
}
function initPortalScopeFromPage(){
  const scope=readPortalScopeFromUrl();
  if(scope){
    try{ sessionStorage.setItem(PORTAL_SCOPE_KEY, JSON.stringify(scope)); }catch(_){}
  }
}
function getPortalScope(){
  try{
    const fromUrl=readPortalScopeFromUrl();
    if(fromUrl) return fromUrl;
    const raw=sessionStorage.getItem(PORTAL_SCOPE_KEY);
    return raw?JSON.parse(raw):null;
  }catch(_){ return null; }
}
function portalScopeCarrierLabel(scope){
  const sc=resolvePortalScope(scope);
  if(!sc) return '';
  if(sc.companyId){
    const co=typeof findCompanyById==='function'?findCompanyById(sc.companyId):null;
    if(co){
      const sp=co.spaceId?findSpaceById(co.spaceId):null;
      return sp?sp.name:(co.name||'');
    }
  }
  if(sc.spaceId){
    const sp=findSpaceById(sc.spaceId);
    return sp?sp.name:'';
  }
  if(sc.portalSlug){
    const sp=findSpaceByPortalSlug(sc.portalSlug);
    return sp?sp.name:'';
  }
  return '';
}
function goEntryLanding(mode){
  const page=entryLandingPage(mode);
  try{
    const u=new URL(page, location.href);
    location.href=u.href;
  }catch(_){
    location.href=page;
  }
}
function backFromEntryLogin(){
  const m=getEntryMode();
  if(m==='admin'){ location.href='kp.html'; return; }
  if(m==='driver'||m==='customer'){ goEntryLanding(m); return; }
  if(typeof show==='function') show('roles');
}
/** Backend API (S0). Локально → armada-api; на aptown1 → Caddy prefix. */
const API_BASE=(()=>{
  if(typeof location==='undefined') return '';
  const h=location.hostname;
  if(h==='localhost'||h==='127.0.0.1') return 'http://127.0.0.1:8787';
  if(h==='aptown1.fvds.ru') return `${location.origin}/armada-api`;
  return '';
})();
const DEFAULT_OWN_COMPANIES=[
  {name:"ООО «Армада»", roles:["own"], note:"Наша фирма — договоры и заявки"},
  {name:"ИП Нечаев А.С.", roles:["own"], note:"Наша фирма — договоры и заявки"}
];
const DEFAULT_ADMINS=[
  {id:"admin-super", name:"Наволоцкий Е.Н.", pin:"", isSuper:true}
];
/** Старые тестовые учётки — вычищаем при каждой миграции, даже если старый браузер вернул их с кэша */
const RETIRED_ADMIN_IDS=new Set(["admin-dispatcher"]);
const RETIRED_ADMIN_NAMES=new Set(["диспетчер"]);
/** Дубликат заказа Наволоцкого на ИП Нечаев — не воскрешать из кэша вкладок */
const RETIRED_ORDER_IDS=new Set(["2b08ea51-8d08-4377-8f0d-80aa3b417dda"]);
const DRIVER_INVITE_TTL_MS=7*24*60*60*1000;
const KEY="armada_app_v5";
const OLD_KEY="armada_app_v4";
const DEVICE_KEY="armada_admin_device";
const ADMIN_SESSION_KEY="armada_admin_session_v1";
const ARMADA_API_TOKEN_KEY="armada_api_token_v1";
const LAST_ROLE_KEY="armada_last_role_v1";
const PRESENCE_ONLINE_MS=90*1000;
const PRESENCE_TICK_MS=25*1000;
const AUTO_SYNC_MS=28*1000;
const AUTO_SYNC_SLOW_MS=50*1000;
const FETCH_TIMEOUT_MS=10000;
const FETCH_PREFLIGHT_MS=6000;
const PERSIST_DEBOUNCE_MS=1400;
const SYNC_BACKOFF_MAX_MS=90000;
/** UUID без HTTPS: crypto.randomUUID на http:// часто недоступен и ломал «Открыть смену». */
function uuid(){
  try{
    const c=globalThis.crypto;
    if(c&&typeof c.randomUUID==='function'){
      return c.randomUUID.call(c);
    }
  }catch(_){}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=Math.random()*16|0;
    const v=c==='x'?r:(r&0x3|0x8);
    return v.toString(16);
  });
}
/** Общая база на VPS; с GitHub Pages тоже ходим сюда (нужен HTTP-сайт приложения). */
const PB_BASE=(function(){
  const h=location.hostname;
  if(h==='aptown1.fvds.ru'||h==='176.12.67.35') return location.origin;
  return 'http://aptown1.fvds.ru';
})();
console.info("АРМАДА build", APP_BUILD, "PB", PB_BASE);
const saved=JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(OLD_KEY)||"{}");
const DEFAULT_FINANCE={markupPercent:15,cityKmThreshold:100,minWorkHours:4,podachaHours:1,podachaEmptyKmLimit:20,defaultRatePerHourWork:0,defaultRatePerKmCash:80};
function normalizeFinance(f){
  const s=Object.assign({}, DEFAULT_FINANCE, f||{});
  let markup=+s.markupPercent; if(Number.isNaN(markup)) markup=15;
  s.markupPercent=Math.min(80, Math.max(0, markup));
  s.cityKmThreshold=(+s.cityKmThreshold>0)?+s.cityKmThreshold:100;
  s.minWorkHours=(+s.minWorkHours>=0)?+s.minWorkHours:4;
  s.podachaHours=(+s.podachaHours>=0)?+s.podachaHours:1;
  s.podachaEmptyKmLimit=(+s.podachaEmptyKmLimit>0)?+s.podachaEmptyKmLimit:20;
  s.defaultRatePerHourWork=(+s.defaultRatePerHourWork>0)?+s.defaultRatePerHourWork:0;
  s.defaultRatePerKmCash=(+s.defaultRatePerKmCash>0)?+s.defaultRatePerKmCash:80;
  return s;
}
const state={
  step:"idle", orderStep:"idle", messages:[], shift:null,
  shifts:saved.shifts||[], orders:Array.isArray(saved.orders)?saved.orders:[], seq:saved.seq||0,
  vehicles:saved.vehicles&&saved.vehicles.length?saved.vehicles:DEFAULT_VEHICLES.map(v=>({...v})),
  drivers:saved.drivers&&saved.drivers.length?saved.drivers:DEFAULT_DRIVERS.map(d=>({...d})),
  customers:Array.isArray(saved.customers)?saved.customers:[],
  companies:Array.isArray(saved.companies)?saved.companies:[],
  finance:Object.assign({}, DEFAULT_FINANCE, saved.finance||{}),
  admins:Array.isArray(saved.admins)?saved.admins:[],
  adminLogins:Array.isArray(saved.adminLogins)?saved.adminLogins:[],
  adminPresence:Array.isArray(saved.adminPresence)?saved.adminPresence:[],
  spaces:Array.isArray(saved.spaces)?saved.spaces:[],
  settings:Object.assign({fnsApiKey:'',dadataToken:''}, saved.settings||{}),
  dataEpoch:Number(saved.dataEpoch)||0,
  deletedOrderIds:Array.isArray(saved.deletedOrderIds)?saved.deletedOrderIds.slice():[],
  driverInvites:Array.isArray(saved.driverInvites)?saved.driverInvites:[],
  light:{}, draft:{}, error:"", adminFilter:"all", adminOwnerFilter:"all", detailId:null,
  adminExpandedGroups: (saved.adminExpandedGroups && typeof saved.adminExpandedGroups==='object')?saved.adminExpandedGroups:{},
  billing:(saved.billing && typeof saved.billing==='object')?saved.billing:{spaces:{}}
};
let pbRecordId=null;
let persistTimer=null;
let autoSyncTimer=null;
let autoSyncBusy=false;
let syncPushInFlight=null;
let syncPushQueued=false;
let pullBackoffUntil=0;
let pullFailCount=0;
let syncStatus='local'; // local | syncing | ok | error
let currentAdmin=null; // {id,name,isSuper,spaceId} — только в этой вкладке
let presenceTimer=null;
let catalogTab='companies'; // companies | drivers | vehicles | finance
let catalogFinanceCompanyId=null; // какая «наша фирма» правится во вкладке Тариф
function adminDeviceId(){
  let id=localStorage.getItem(DEVICE_KEY);
  if(!id){ id=uuid(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}
if(!(state.finance.markupPercent>=0)) state.finance.markupPercent=15;
if(state.finance.markupPercent>80) state.finance.markupPercent=80;
if(!(state.finance.cityKmThreshold>0)) state.finance.cityKmThreshold=100;
if(!(state.finance.minWorkHours>=0)) state.finance.minWorkHours=4;
if(!(state.finance.podachaHours>=0)) state.finance.podachaHours=1;
if(!(state.finance.podachaEmptyKmLimit>0)) state.finance.podachaEmptyKmLimit=20;
if(!(state.finance.defaultRatePerHourWork>=0)) state.finance.defaultRatePerHourWork=0;
if(!(state.finance.defaultRatePerKmCash>0)) state.finance.defaultRatePerKmCash=80;
// Миграция только если в localStorage вообще не было массива orders
if(!Array.isArray(saved.orders) && state.shifts.length){
  state.orders=state.shifts.flatMap(s=>s.orders||[]);
}
function kindTitle(kind){ return kind==='unloading'?'Выгрузка':'Загрузка'; }
function normalizePoint(p, fallbackKind){
  if(typeof p==='string'){
    const address=String(p||'').trim();
    return address?{id:uuid(),address,kind:fallbackKind||'loading'}:null;
  }
  if(!p||typeof p!=='object') return null;
  const address=String(p.address||'').trim();
  if(!address) return null;
  const kind=p.kind==='unloading'?'unloading':'loading';
  return {id:p.id||uuid(),address,kind};
}
function defaultRoutePoints(load, unload){
  return [
    {id:uuid(),address:String(load||'').trim()||'Адрес загрузки',kind:'loading'},
    {id:uuid(),address:String(unload||'').trim()||'Адрес выгрузки',kind:'unloading'}
  ];
}
function ensureRoutePoints(o){
  let raw=Array.isArray(o.routePoints)?o.routePoints:[];
  let pts=[];
  if(raw.length && typeof raw[0]==='string'){
    pts=raw.map((addr,i)=>normalizePoint(addr, i===raw.length-1?'unloading':'loading')).filter(Boolean);
  } else {
    pts=raw.map(p=>normalizePoint(p)).filter(Boolean);
  }
  if(pts.length<2) pts=defaultRoutePoints(o.loadingAddress, o.unloadingAddress);
  o.routePoints=pts;
  o.loadingAddress=(pts.find(p=>p.kind==='loading')||pts[0]).address;
  o.unloadingAddress=( [...pts].reverse().find(p=>p.kind==='unloading')||pts[pts.length-1]).address;
  return pts;
}
function routeText(o){
  return ensureRoutePoints(o).map(p=>`${kindTitle(p.kind)}: ${p.address}`).join(' → ');
}
const $ = id => document.getElementById(id);
function show(id){
  if(id==='driver'||id==='admin'||id==='admin-detail'||id==='admin-create'||id==='admin-claim'||id==='admin-catalogs-screen'||id==='admin-activity-screen'||id==='admin-billing-screen'||id==='admin-links-screen'||id==='admin-vehicle-card'||id==='customer-portal'){
    if(typeof clearEntrySkin==='function') clearEntrySkin();
  }
  document.querySelectorAll('.phone > .screen').forEach(s=>s.classList.remove('show'));
  $(id).classList.add('show');
  const wide = id==='admin'||id==='admin-detail'||id==='admin-create'||id==='admin-claim'||id==='admin-catalogs-screen'||id==='admin-activity-screen'||id==='admin-billing-screen'||id==='admin-links-screen'||id==='admin-vehicle-card'||id==='customer-portal';
  $('shell').classList.toggle('wide', wide);
  try{
    if(id==='driver') localStorage.setItem(LAST_ROLE_KEY,'driver');
    else if(wide) localStorage.setItem(LAST_ROLE_KEY,'admin');
  }catch(_){}
  if(currentAdmin && wide){
    touchAdminPresence(id);
  }
}
const SPLASH_STARTED_MS=Date.now();
const MIN_SPLASH_MS=900;
function showAfterSplash(idOrFn){
  const wait=Math.max(0, MIN_SPLASH_MS-(Date.now()-SPLASH_STARTED_MS));
  const run=()=>{
    if(typeof idOrFn==='function') idOrFn();
    else show(idOrFn);
  };
  if(wait<=0){ run(); return; }
  setTimeout(run, wait);
}
function isCancelledOrder(o){
  return !!(o && (o.cancelledAt || (o.closedAt && o.cancelReason)));
}
function deletedOrderIdSet(){
  const s=new Set(state.deletedOrderIds||[]);
  RETIRED_ORDER_IDS.forEach(id=>s.add(id));
  return s;
}
function rememberDeletedOrderId(id){
  if(!id) return;
  const list=state.deletedOrderIds||(state.deletedOrderIds=[]);
  if(!list.includes(id)) list.push(id);
}
function unionDeletedOrderIds(extra){
  const list=state.deletedOrderIds||(state.deletedOrderIds=[]);
  RETIRED_ORDER_IDS.forEach(id=>{ if(!list.includes(id)) list.push(id); });
  (extra||[]).forEach(id=>{ if(id && !list.includes(id)) list.push(id); });
  return list;
}
function stripCancelledFromOrders(orders){
  const dead=deletedOrderIdSet();
  return (orders||[]).filter(o=>o && !isCancelledOrder(o) && !dead.has(o.id));
}
/** Вычистить retired/отменённые из orders и смен (чтобы дубль не висел на сервере). */
function purgeDeadOrdersEverywhere(){
  unionDeletedOrderIds([]);
  const before=(state.orders||[]).length;
  state.orders=stripCancelledFromOrders(state.orders);
  (state.shifts||[]).forEach(s=>{
    if(Array.isArray(s.orders)) s.orders=stripCancelledFromOrders(s.orders);
  });
  return before!==(state.orders||[]).length;
}
/**
 * Сквозные № базы без дыр: 1…N по дате создания.
 * Иначе после удаления дубля следующий заказ получает max+1 (№5 при живых 1–3).
 */
function compactSequentialNumbers(){
  purgeDeadOrdersEverywhere();
  const list=(state.orders||[]).slice().sort((a,b)=>{
    const ta=new Date(a.createdAt||0).getTime();
    const tb=new Date(b.createdAt||0).getTime();
    if(ta!==tb) return ta-tb;
    return String(a.id||'').localeCompare(String(b.id||''));
  });
  let changed=false;
  list.forEach((o,i)=>{
    const n=i+1;
    if(+o.sequentialNumber!==n){ o.sequentialNumber=n; changed=true; }
  });
  const next=list.length;
  if(+state.seq!==next){ state.seq=next; changed=true; }
  const byId=new Map(list.map(o=>[o.id,o]));
  (state.shifts||[]).forEach(s=>{
    if(!Array.isArray(s.orders)) return;
    s.orders.forEach((o,idx)=>{
      const live=byId.get(o.id);
      if(live) s.orders[idx]=live;
    });
  });
  state.orders=list.slice().sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  return changed;
}
function nextSequentialNumber(){
  compactSequentialNumbers();
  state.seq=(Number(state.seq)||0)+1;
  return state.seq;
}
function bumpDataEpoch(reason){
  state.dataEpoch=(Number(state.dataEpoch)||0)+1;
  console.info('dataEpoch →', state.dataEpoch, reason||'');
}
/** S3-2.6: журнал ops для супер-админа (ЭТрН, API). */
function logOpsEvent(kind, detail, meta){
  if(!state.opsLog) state.opsLog=[];
  state.opsLog.unshift({
    id:uuid(),
    at:new Date().toISOString(),
    kind:String(kind||'info'),
    detail:String(detail||''),
    meta:meta&&typeof meta==='object'?meta:null
  });
  if(state.opsLog.length>60) state.opsLog.length=60;
}
function snapshot(){
  // Отменённые никогда не уезжают на сервер — иначе старая вкладка воскрешает их.
  const orders=stripCancelledFromOrders(state.orders);
  const shifts=(state.shifts||[]).map(s=>{
    const copy={...s};
    if(Array.isArray(copy.orders)) copy.orders=stripCancelledFromOrders(copy.orders);
    return copy;
  });
  return {
    shifts,
    orders,
    seq:state.seq,
    vehicles:state.vehicles,
    drivers:state.drivers,
    customers:state.customers,
    companies:state.companies,
    finance:state.finance,
    admins:state.admins,
    adminLogins:state.adminLogins,
    adminPresence:state.adminPresence,
    spaces:state.spaces,
    settings:state.settings,
    deletedOrderIds:Array.from(deletedOrderIdSet()),
    driverInvites:Array.isArray(state.driverInvites)?state.driverInvites:[],
    dataEpoch:Number(state.dataEpoch)||0,
    billing:typeof billingSnapshotSlice==='function'?billingSnapshotSlice():state.billing,
    opsLog:Array.isArray(state.opsLog)?state.opsLog:[],
    savedAt:new Date().toISOString(),
    appBuild:APP_BUILD
  };
}
function scorePayload(p){
  if(!p||typeof p!=='object') return 0;
  return (p.orders&&p.orders.length||0)*10 + (p.shifts&&p.shifts.length||0)*3
    + (p.companies&&p.companies.length||0) + (p.customers&&p.customers.length||0) + (p.seq||0);
}
function applyPayload(p, opts){
  if(!p||typeof p!=='object') return;
  const keepShifts=opts&&opts.keepShifts;
  const keepOrders=opts&&opts.keepOrders;
  // Сначала tombstone (+ RETIRED), потом фильтр заказов — иначе дубль снова попадает в список
  unionDeletedOrderIds(p.deletedOrderIds||[]);
  state.shifts=Array.isArray(p.shifts)?p.shifts:[];
  (state.shifts||[]).forEach(s=>{ if(Array.isArray(s.orders)) s.orders=stripCancelledFromOrders(s.orders); });
  // Явный массив orders с сервера (в т.ч. []) — закон. Не поднимаем заказы из смен.
  state.orders=Array.isArray(p.orders)?stripCancelledFromOrders(p.orders):[];
  // remoteSeq: сервер задаёт счётчик № базы целиком (после удаления дубля можно сжать нумерацию).
  // Иначе Math.max не даёт seq уменьшиться со старой вкладки.
  if(opts&&opts.remoteSeq) state.seq=Number(p.seq)||0;
  else state.seq=Math.max(Number(p.seq)||0, Number(state.seq)||0);
  state.vehicles=(p.vehicles&&p.vehicles.length)?p.vehicles.map(normalizeFleetVehicle).filter(Boolean):DEFAULT_VEHICLES.map(v=>normalizeFleetVehicle(v)).filter(Boolean);
  state.drivers=(p.drivers&&p.drivers.length)?p.drivers:DEFAULT_DRIVERS.map(d=>({...d}));
  state.customers=Array.isArray(p.customers)?p.customers:[];
  state.companies=Array.isArray(p.companies)?p.companies:[];
  state.finance=Object.assign({}, DEFAULT_FINANCE, p.finance||{});
  state.spaces=Array.isArray(p.spaces)?p.spaces:[];
  if(typeof applyBillingPayload==='function') applyBillingPayload(p.billing);
  else if(p.billing&&typeof p.billing==='object') state.billing=p.billing;
  state.settings=Object.assign({fnsApiKey:'',dadataToken:''}, state.settings||{}, p.settings||{});
  state.driverInvites=Array.isArray(p.driverInvites)?p.driverInvites:[];
  state.opsLog=Array.isArray(p.opsLog)?p.opsLog:[];
  state.dataEpoch=Number(p.dataEpoch)||0;
  mergeAdminAuthFromRemote(p);
  if(!(state.finance.markupPercent>=0)) state.finance.markupPercent=15;
  if(state.finance.markupPercent>80) state.finance.markupPercent=80;
  if(!(state.finance.cityKmThreshold>0)) state.finance.cityKmThreshold=100;
  if(!(state.finance.minWorkHours>=0)) state.finance.minWorkHours=4;
  if(!(state.finance.podachaHours>=0)) state.finance.podachaHours=1;
  if(!(state.finance.podachaEmptyKmLimit>0)) state.finance.podachaEmptyKmLimit=20;
  if(!(state.finance.defaultRatePerHourWork>=0)) state.finance.defaultRatePerHourWork=0;
  if(!(state.finance.defaultRatePerKmCash>0)) state.finance.defaultRatePerKmCash=80;
  // Только если поле orders вообще отсутствовало в старых дампах.
  if(!('orders' in p) && state.shifts.length && !state.orders.length){
    state.orders=stripCancelledFromOrders(state.shifts.flatMap(s=>s.orders||[]));
  }
  if(keepShifts) mergeLocalShifts(keepShifts);
  if(keepOrders) mergeLocalOrders(keepOrders);
  state.orders=stripCancelledFromOrders(state.orders);
  state.orders.forEach(o=>{
    if(o.customer==null) o.customer="";
    if(o.driverPercent==null) o.driverPercent=driverPercent(o.driverName||DRIVER);
    ensureRoutePoints(o);
  });
  migrateCompanies();
  migrateAdmins();
  migrateDriverOwners();
  migrateSpaces();
  if(typeof migrateBilling==='function') migrateBilling();
  migrateDriverOrderOwners();
  migrateShiftOwners();
  migrateDriverPins();
  migrateCompanyFinance();
  healVehicleOdometersFromShifts();
  ensureManufacturerServiceIntervals();
  migrateEtoFromMessages();
  // Заказы только в смене (потерялись из state.orders) — поднять в общий список
  (state.shifts||[]).forEach(s=>{
    (s.orders||[]).forEach(o=>{
      if(!o||!o.id) return;
      if(deletedOrderIdSet().has(o.id)) return;
      if(!(state.orders||[]).some(x=>x.id===o.id)){
        state.orders.push(o);
      }
    });
  });
  state.orders=stripCancelledFromOrders(state.orders);
  // Наоборот: заказы в списке, но выпали из смены — вернуть в смену + чат
  healOrphanOrdersIntoShifts();
  healAllOrders();
  purgeCancelledOrders();
  compactSequentialNumbers();
}
/** Водитель без владельца → админ с тем же ФИО (после migrateAdmins). */
function migrateDriverOwners(){
  let changed=false;
  (state.drivers||[]).forEach(d=>{
    if(d.ownerAdminId) return;
    const adm=(state.admins||[]).find(a=>(a.name||'').trim().toLowerCase()===(d.name||'').trim().toLowerCase());
    if(adm){ d.ownerAdminId=adm.id; d.ownerAdminName=adm.name; changed=true; }
  });
  return changed;
}
function defaultFirmNameForAdmin(adminName){
  const n=(adminName||'').trim().toLowerCase();
  if(n.includes('нечаев')) return 'ИП Нечаев А.С.';
  if(n.includes('наволоцк')) return 'ООО «Армада»';
  return adminName||'Фирма';
}
function slugifyPortalSlug(name, id){
  let s=String(name||'').trim().toLowerCase()
    .replace(/^(ооо|ип|ооо\s+|ип\s+)\s*/i,'')
    .replace(/[«»"'„]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,24);
  if(s.length>=3 && /^[a-z0-9][a-z0-9-]*$/.test(s)) return s;
  const tail=String(id||'').replace(/-/g,'').slice(0,8);
  return 'p'+(tail||'x');
}
function findSpaceByPortalSlug(slug){
  const s=String(slug||'').trim().toLowerCase();
  if(!s) return null;
  return (state.spaces||[]).find(sp=>String(sp.portalSlug||'').toLowerCase()===s)||null;
}
function normalizeSpace(s){
  if(!s||typeof s!=='object') return null;
  const id=s.id||uuid();
  const name=String(s.name||'').trim(); if(!name) return null;
  let portalSlug=String(s.portalSlug||'').trim().toLowerCase()
    .replace(/[^a-z0-9-]/g,'').replace(/^-+|-+$/g,'').slice(0,32);
  if(!portalSlug) portalSlug=slugifyPortalSlug(name, id);
  const portalLogo=String(s.portalLogo||'').trim();
  return {
    id, name,
    portalSlug,
    portalLogo:portalLogo.startsWith('data:image')?portalLogo:'',
    inn:String(s.inn||'').trim(),
    ogrn:String(s.ogrn||'').trim(),
    kpp:String(s.kpp||'').trim(),
    address:String(s.address||'').trim(),
    director:String(s.director||'').trim(),
    adminId:s.adminId||null,
    adminName:String(s.adminName||'').trim(),
    ownCompanyId:s.ownCompanyId||null,
    createdAt:s.createdAt||new Date().toISOString()
  };
}
function findSpaceById(id){ return (state.spaces||[]).find(s=>s.id===id)||null; }
function currentSpaceId(){ return (currentAdmin&&currentAdmin.spaceId)||null; }
function samePersonName(a,b){
  return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
}
/** «Наша фирма» пространства — у каждого админа своя. */
function ensureOwnCompanyForSpace(space){
  if(!space) return null;
  if(space.ownCompanyId){
    const existing=findCompanyById(space.ownCompanyId);
    if(existing && companyHasRole(existing,'own')){
      if(existing.spaceId!==space.id) existing.spaceId=space.id;
      return existing;
    }
    // ownCompanyId есть, а компании нет (удалили/потеряли) — восстанавливаем с тем же id
    if(!existing){
      const restored=upsertCompany({
        id:space.ownCompanyId,
        name:space.name, roles:['own'], note:space.inn?`ИНН ${space.inn}`:'',
        contacts:[], phones:[], loadingAddresses:[], unloadingAddresses:[], vehicles:[], drivers:[],
        spaceId:space.id, inn:space.inn, ogrn:space.ogrn, kpp:space.kpp, address:space.address
      });
      if(restored) return restored;
    }
  }
  let co=(state.companies||[]).find(c=>c.spaceId===space.id && companyHasRole(c,'own'));
  if(!co){
    co=(state.companies||[]).find(c=>companyHasRole(c,'own') && (c.name||'').trim().toLowerCase()===(space.name||'').trim().toLowerCase());
  }
  if(!co){
    co=upsertCompany({
      name:space.name, roles:['own'], note:space.inn?`ИНН ${space.inn}`:'',
      contacts:[], phones:[], loadingAddresses:[], unloadingAddresses:[], vehicles:[], drivers:[],
      spaceId:space.id, inn:space.inn, ogrn:space.ogrn, kpp:space.kpp, address:space.address
    });
  } else {
    co.spaceId=space.id;
    if(!companyHasRole(co,'own')) co.roles.push('own');
    upsertCompany(co);
  }
  if(co) space.ownCompanyId=co.id;
  return co||null;
}
/** Водитель с таким ФИО уже есть именно в этой фирме (в другой фирме — можно). */
function driverExistsInCompany(name, companyId){
  if(!companyId) return (state.drivers||[]).some(d=>samePersonName(d.name,name));
  return (state.drivers||[]).some(d=>samePersonName(d.name,name) && d.companyId===companyId);
}
function ensureDriverInCompany(opts){
  const name=String(opts.name||'').trim();
  const companyId=opts.companyId;
  if(!name||!companyId) return false;
  if(driverExistsInCompany(name, companyId)) return false;
  state.drivers.push({
    name,
    salaryPercent:opts.salaryPercent??30,
    exchangeEnabled:!!opts.exchangeEnabled,
    phone:formatPhone(opts.phone||''),
    pin:String(opts.pin||'').trim(),
    ownerAdminId:opts.ownerAdminId||null,
    ownerAdminName:opts.ownerAdminName||null,
    spaceId:opts.spaceId||null,
    companyId,
    companyName:opts.companyName||null
  });
  return true;
}
/** PIN водителя: свой → PIN админа с тем же ФИО → последние 4 цифры телефона. */
function resolveDriverPin(d){
  if(!d) return '';
  const own=String(d.pin||'').trim();
  if(own.length>=4) return own;
  const adm=(state.admins||[]).find(a=>samePersonName(a.name, d.name));
  if(adm && String(adm.pin||'').trim().length>=4) return String(adm.pin).trim();
  const ph=formatPhone(d.phone||'');
  if(ph.length>=4) return ph.slice(-4);
  return '';
}
function migrateDriverPins(){
  let changed=false;
  (state.drivers||[]).forEach(d=>{
    if(!d) return;
    if(String(d.pin||'').trim().length>=4) return;
    const adm=(state.admins||[]).find(a=>samePersonName(a.name, d.name));
    if(adm && String(adm.pin||'').trim().length>=4){
      d.pin=String(adm.pin).trim(); changed=true; return;
    }
    const ph=formatPhone(d.phone||'');
    if(ph.length>=4){ d.pin=ph.slice(-4); changed=true; }
  });
  return changed;
}
function findDriversByPhone(phone){
  const p=formatPhone(phone);
  if(!p) return [];
  return (state.drivers||[]).filter(d=>formatPhone(d.phone||'')===p);
}
function driverInviteKey(d){
  if(!d) return '';
  return `${String(d.name||'').trim()}|${d.companyId||''}`;
}
function findValidDriverInvite(token){
  if(!token) return null;
  const inv=(state.driverInvites||[]).find(x=>x&&x.token===token && !x.usedAt && !x.revokedAt);
  if(!inv) return null;
  if(inv.expiresAt && new Date(inv.expiresAt).getTime()<Date.now()) return null;
  return inv;
}
function driverInvitePageUrl(token){
  const dir=location.pathname.replace(/[^/]*$/,'');
  return `${location.origin}${dir}invite.html?token=${encodeURIComponent(token)}`;
}
async function createDriverInvite(driverIndex){
  const d=(state.drivers||[])[driverIndex];
  if(!d) return {ok:false, message:'Водитель не найден'};
  const phone=formatPhone(d.phone||'');
  if(!phone) return {ok:false, message:'Укажите телефон водителя'};
  if(currentAdmin && typeof billingGuardCurrentAdminWithServer==='function'){
    const g=await billingGuardCurrentAdminWithServer('add_driver');
    if(!g.ok) return {ok:false, message:g.message};
  }
  if(!state.driverInvites) state.driverInvites=[];
  const key=driverInviteKey(d);
  state.driverInvites.forEach(inv=>{
    if(inv && inv.driverKey===key && !inv.usedAt && !inv.revokedAt) inv.revokedAt=new Date().toISOString();
  });
  const token=uuid();
  const inv={
    id:uuid(), token, driverKey:key,
    driverName:String(d.name||'').trim(),
    companyId:d.companyId||null,
    spaceId:d.spaceId||null,
    phone,
    createdAt:new Date().toISOString(),
    expiresAt:new Date(Date.now()+DRIVER_INVITE_TTL_MS).toISOString(),
    createdByAdminId:currentAdmin&&currentAdmin.id,
    createdByAdminName:currentAdmin&&currentAdmin.name,
    usedAt:null, revokedAt:null
  };
  state.driverInvites.push(inv);
  bumpDataEpoch('driver-invite');
  persist();
  return {ok:true, invite:inv, url:driverInvitePageUrl(token)};
}
function consumeDriverInvite(token, pin){
  const inv=findValidDriverInvite(token);
  if(!inv) return {ok:false, message:'Ссылка недействительна, истекла или уже использована'};
  const pinStr=String(pin||'').trim();
  if(pinStr.length<4) return {ok:false, message:'PIN — минимум 4 цифры'};
  const rec=findDriverRecord(inv.driverName, inv.companyId);
  if(!rec) return {ok:false, message:'Водитель не найден — обратитесь к администратору'};
  if(formatPhone(rec.phone||'')!==inv.phone) return {ok:false, message:'Телефон водителя изменился — запросите новую ссылку'};
  rec.pin=pinStr;
  inv.usedAt=new Date().toISOString();
  bumpDataEpoch('driver-invite-used');
  persist();
  return {ok:true, driver:rec};
}
function pickDriverHomeRecord(list){
  if(!list||!list.length) return null;
  const home=list.find(d=>{
    const adm=(state.admins||[]).find(a=>a.id===d.ownerAdminId);
    return adm && samePersonName(adm.name, d.name);
  });
  return home||list[0];
}
/** Парк (водители/авто) — отдельно на каждую «нашу фирму». */
function ensureFleetPerSpaces(){
  let changed=false;
  // Старые «общие» водители без фирмы — привязать к фирме владельца/админа с тем же ФИО
  (state.drivers||[]).forEach(d=>{
    if(d.companyId && findCompanyById(d.companyId)) return;
    const adm=(state.admins||[]).find(a=>a.id===d.ownerAdminId)
      || (state.admins||[]).find(a=>samePersonName(a.name, d.name));
    if(!adm) return;
    const co=ownCompanyForAdminId(adm.id);
    if(!co) return;
    d.ownerAdminId=adm.id;
    d.ownerAdminName=adm.name;
    d.spaceId=adm.spaceId||co.spaceId||null;
    d.companyId=co.id;
    d.companyName=co.name;
    changed=true;
  });
  (state.spaces||[]).forEach(sp=>{
    const co=ensureOwnCompanyForSpace(sp);
    if(!co) return;
    if(co.spaceId!==sp.id){ co.spaceId=sp.id; changed=true; }
    (state.drivers||[]).forEach(d=>{
      if(d.spaceId===sp.id && d.companyId!==co.id){
        d.companyId=co.id; d.companyName=co.name; changed=true;
      }
    });
    (state.vehicles||[]).forEach(v=>{
      if(v.spaceId!==sp.id) return;
      if(v.companyId!==co.id || v.companyName!==co.name){
        v.companyId=co.id; v.companyName=co.name; changed=true;
      }
    });
    const adm=(state.admins||[]).find(a=>a.id===sp.adminId)
      || (state.admins||[]).find(a=>a.spaceId===sp.id);
    // В каждую фирму — известные водители (копии), чтобы не вводить заново
    DEFAULT_DRIVERS.forEach(def=>{
      if(ensureDriverInCompany({
        name:def.name,
        salaryPercent:def.salaryPercent??30,
        exchangeEnabled:!!def.exchangeEnabled,
        phone:def.phone||'',
        companyId:co.id, companyName:co.name, spaceId:sp.id,
        ownerAdminId:adm?adm.id:null, ownerAdminName:adm?adm.name:null
      })) changed=true;
    });
    if(adm && ensureDriverInCompany({
      name:adm.name, companyId:co.id, companyName:co.name, spaceId:sp.id,
      ownerAdminId:adm.id, ownerAdminName:adm.name
    })) changed=true;
    // У каждой «нашей фирмы» должен быть хотя бы один автомобиль для смены/ЕТО
    if(!fleetVehiclesForCompany(co.id).length){
      const nm=(co.name||'').toLowerCase();
      const seedPlate=nm.includes('нечаев')?'К 001 КК 47'
        :(nm.includes('армада')?(DEFAULT_VEHICLES[0]&&DEFAULT_VEHICLES[0].plate)||'О 535 МВ 198'
        :`Х ${String(100+((co.id||co.name||'').length*17)%900).padStart(3,'0')} ХХ 47`);
      const def=DEFAULT_VEHICLES[0]||{consumptionPer100Km:20,payloadTons:5,bodyLengthM:6,bodyWidthM:2.4,bodyHeightM:2.2};
      state.vehicles.push(normalizeFleetVehicle({
        plate:seedPlate,
        consumptionPer100Km:def.consumptionPer100Km||20,
        payloadTons:def.payloadTons||5,
        bodyLengthM:def.bodyLengthM||6, bodyWidthM:def.bodyWidthM||2.4, bodyHeightM:def.bodyHeightM||2.2,
        makeModel:'', spaceId:sp.id, companyId:co.id, companyName:co.name
      }));
      changed=true;
    }
  });
  // Телефоны: из контактов «нашей фирмы» / других копий того же ФИО
  (state.drivers||[]).forEach(d=>{
    if((d.phone||'').trim()) return;
    let ph='';
    const co=findCompanyById(d.companyId);
    if(co){
      for(const p of (co.contacts||[])){
        if(samePersonName(p.name, d.name)){ ph=contactPhone(p); if(ph) break; }
      }
    }
    if(!ph){
      const twin=(state.drivers||[]).find(x=>samePersonName(x.name,d.name) && (x.phone||'').trim());
      if(twin) ph=String(twin.phone).trim();
    }
    if(!ph){
      for(const c of (state.companies||[])){
        if(!companyHasRole(c,'own')) continue;
        for(const p of (c.contacts||[])){
          if(samePersonName(p.name, d.name)){ ph=contactPhone(p); if(ph) break; }
        }
        if(ph) break;
      }
    }
    if(ph){ d.phone=formatPhone(ph); changed=true; }
  });
  if(normalizeAllPhones()) changed=true;
  return changed;
}
function ownCompanyForSpaceId(spaceId){
  const sp=findSpaceById(spaceId);
  return sp?ensureOwnCompanyForSpace(sp):null;
}
function ownCompanyForAdminId(adminId){
  const adm=(state.admins||[]).find(a=>a.id===adminId);
  if(!adm||!adm.spaceId) return null;
  return ownCompanyForSpaceId(adm.spaceId);
}
function currentOwnCompany(){
  if(!currentAdmin) return null;
  return ownCompanyForAdminId(currentAdmin.id) || ownCompanyForSpaceId(currentSpaceId());
}
function ownCompaniesList(){
  return (state.companies||[]).filter(c=>companyHasRole(c,'own'));
}
/** Тариф фирмы. Заказы и расчёты берут настройки «нашей фирмы» заказа. */
function financeForCompanyId(companyId){
  const co=companyId?findCompanyById(companyId):null;
  if(co && co.finance) return normalizeFinance(co.finance);
  return normalizeFinance(state.finance);
}
function financeForOrder(o){
  const id=o&&(o.ownCompanyId||null);
  if(id) return financeForCompanyId(id);
  const my=currentOwnCompany();
  if(my) return financeForCompanyId(my.id);
  return normalizeFinance(state.finance);
}
function catalogFinanceCompany(){
  if(!isSuperAdmin()) return currentOwnCompany();
  if(catalogFinanceCompanyId){
    const hit=findCompanyById(catalogFinanceCompanyId);
    if(hit && companyHasRole(hit,'own')) return hit;
  }
  const my=currentOwnCompany();
  if(my) return my;
  return ownCompaniesList()[0]||null;
}
/** Раздать общий тариф по «нашим фирмам», если у фирмы ещё нет своего. */
function migrateCompanyFinance(){
  let changed=false;
  const seed=normalizeFinance(state.finance);
  (state.companies||[]).forEach(c=>{
    if(!companyHasRole(c,'own')) return;
    if(!c.finance){ c.finance=Object.assign({}, seed); changed=true; }
    else c.finance=normalizeFinance(c.finance);
  });
  return changed;
}
function createSpaceForAdmin(admin, firm){
  const space=normalizeSpace({
    id:uuid(),
    name:(firm&&firm.name)||defaultFirmNameForAdmin(admin.name),
    inn:(firm&&firm.inn)||'',
    ogrn:(firm&&firm.ogrn)||'',
    kpp:(firm&&firm.kpp)||'',
    address:(firm&&firm.address)||'',
    director:(firm&&firm.director)||'',
    adminId:admin.id,
    adminName:admin.name,
    createdAt:new Date().toISOString()
  });
  state.spaces=(state.spaces||[]).concat([space]);
  if(typeof getBillingForSpace==='function') getBillingForSpace(space.id);
  admin.spaceId=space.id;
  const co=ensureOwnCompanyForSpace(space);
  if(co){
    ensureDriverInCompany({
      name:admin.name, companyId:co.id, companyName:co.name, spaceId:space.id,
      ownerAdminId:admin.id, ownerAdminName:admin.name
    });
  }
  return space;
}
/** У каждого админа — пространство + своя «наша фирма»; водители/авто к ней. */
function migrateSpaces(){
  state.settings=Object.assign({fnsApiKey:'',dadataToken:''}, state.settings||{});
  state.spaces=(state.spaces||[]).map(normalizeSpace).filter(Boolean);
  let changed=false;
  const slugUsed=new Set();
  (state.spaces||[]).forEach(sp=>{
    let slug=String(sp.portalSlug||'').toLowerCase();
    if(!slug || slugUsed.has(slug)){
      slug=slugifyPortalSlug(sp.name, sp.id);
      let n=0;
      while(slugUsed.has(slug)){
        n++;
        slug=slugifyPortalSlug(sp.name, sp.id)+'-'+n;
      }
      sp.portalSlug=slug;
      changed=true;
    }
    slugUsed.add(slug);
  });
  (state.admins||[]).forEach(a=>{
    if(a.spaceId && findSpaceById(a.spaceId)) return;
    const byAdmin=state.spaces.find(s=>s.adminId===a.id);
    if(byAdmin){ a.spaceId=byAdmin.id; changed=true; return; }
    createSpaceForAdmin(a, {name:defaultFirmNameForAdmin(a.name)});
    changed=true;
  });
  (state.spaces||[]).forEach(sp=>{
    const before=sp.ownCompanyId;
    ensureOwnCompanyForSpace(sp);
    if(sp.ownCompanyId!==before) changed=true;
  });
  const superAdm=(state.admins||[]).find(a=>a.isSuper);
  const fallbackSpace=superAdm&&superAdm.spaceId;
  (state.companies||[]).forEach(c=>{
    if(c.spaceId) return;
    const nm=(c.name||'').toLowerCase();
    const hit=(state.spaces||[]).find(s=>(s.name||'').toLowerCase()===nm);
    if(hit){ c.spaceId=hit.id; changed=true; }
  });
  (state.drivers||[]).forEach(d=>{
    if(!d.spaceId){
      const adm=(state.admins||[]).find(x=>x.id===d.ownerAdminId);
      if(adm&&adm.spaceId){ d.spaceId=adm.spaceId; changed=true; }
      else if(fallbackSpace){ d.spaceId=fallbackSpace; changed=true; }
    }
    if(!d.companyId && d.spaceId){
      const co=ownCompanyForSpaceId(d.spaceId);
      if(co){ d.companyId=co.id; d.companyName=co.name; changed=true; }
    }
  });
  (state.vehicles||[]).forEach(v=>{
    if(!v.spaceId && fallbackSpace){ v.spaceId=fallbackSpace; changed=true; }
    if(!v.companyId && v.spaceId){
      const co=ownCompanyForSpaceId(v.spaceId);
      if(co){ v.companyId=co.id; v.companyName=co.name; changed=true; }
    }
  });
  (state.orders||[]).forEach(o=>{
    if(o.spaceId) return;
    const adm=(state.admins||[]).find(x=>x.id===o.ownerAdminId);
    if(adm&&adm.spaceId){ o.spaceId=adm.spaceId; changed=true; }
    else if(fallbackSpace){ o.spaceId=fallbackSpace; changed=true; }
  });
  if(ensureFleetPerSpaces()) changed=true;
  return changed;
}
function isValidInn(inn){
  const s=String(inn||'').replace(/\D/g,'');
  if(s.length===10){
    const n=s.split('').map(Number);
    const c=((2*n[0]+4*n[1]+10*n[2]+3*n[3]+5*n[4]+9*n[5]+4*n[6]+6*n[7]+8*n[8])%11)%10;
    return c===n[9];
  }
  if(s.length===12){
    const n=s.split('').map(Number);
    const c1=((7*n[0]+2*n[1]+4*n[2]+10*n[3]+3*n[4]+5*n[5]+9*n[6]+4*n[7]+6*n[8]+8*n[9])%11)%10;
    const c2=((3*n[0]+7*n[1]+2*n[2]+4*n[3]+10*n[4]+3*n[5]+5*n[6]+9*n[7]+4*n[8]+6*n[9]+8*n[10])%11)%10;
    return c1===n[10] && c2===n[11];
  }
  return false;
}
async function lookupPartyByInnDaData(inn, token){
  const clean=String(inn||'').replace(/\D/g,'');
  const res=await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Accept':'application/json',
      'Authorization':'Token '+token
    },
    body:JSON.stringify({query:clean})
  });
  if(!res.ok) throw new Error('DaData: ошибка '+res.status);
  const data=await res.json();
  const s=(data.suggestions&&data.suggestions[0])||null;
  if(!s||!s.data) throw new Error('По ИНН ничего не найдено (DaData)');
  const d=s.data;
  return {
    name:s.value||d.name?.short_with_opf||d.name?.full_with_opf||'',
    inn:d.inn||clean,
    ogrn:d.ogrn||'',
    kpp:d.kpp||'',
    address:(d.address&& (d.address.value||d.address.unrestricted_value))||'',
    director:(d.management&&d.management.name)|| (d.fio? [d.fio.surname,d.fio.name,d.fio.patronymic].filter(Boolean).join(' '):'')
  };
}
function egrulNalogBase(){
  const h=(location.hostname||'').toLowerCase();
  if(h==='aptown1.fvds.ru'||h==='176.12.67.35'||h==='localhost'||h==='127.0.0.1')
    return location.origin.replace(/\/$/,'')+'/egrul-api';
  // С любого другого URL (GitHub Pages, закладка) — прокси на live, как PB_BASE
  return 'http://aptown1.fvds.ru/egrul-api';
}
function parseEgrulDirectorField(g){
  const s=String(g||'').trim();
  if(!s) return '';
  const m=s.match(/:\s*(.+)$/);
  return m?m[1].trim():s;
}
async function lookupPartyByInnEgrul(inn){
  const clean=String(inn||'').replace(/\D/g,'');
  const base=egrulNalogBase();
  const body=new URLSearchParams({
    vyp3CaptchaToken:'', page:'', query:clean, region:'', PreventChromeAutocomplete:''
  });
  const postRes=await fetch(`${base}/`, {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:body.toString()
  });
  if(!postRes.ok) throw new Error('ФНС ЕГРЮЛ: ошибка '+postRes.status);
  const postData=await postRes.json();
  if(postData.captchaRequired) throw new Error('ФНС: нужна капча на egrul.nalog.ru — попробуйте позже');
  if(!postData.t) throw new Error('ФНС ЕГРЮЛ: пустой ответ');
  await new Promise(r=>setTimeout(r, 2500));
  const res=await fetch(`${base}/search-result/${encodeURIComponent(postData.t)}`);
  if(!res.ok) throw new Error('ФНС ЕГРЮЛ: ошибка '+res.status);
  const data=await res.json();
  const row=(data.rows&&data.rows[0])||null;
  if(!row) throw new Error('По ИНН ничего не найдено в ЕГРЮЛ');
  const isIp=row.k==='ip';
  const director=isIp?(row.n||row.c||''):parseEgrulDirectorField(row.g);
  const name=row.c||row.n||'';
  return {
    name:isIp && name && !/^ИП\s/i.test(name)?'ИП '+name:name,
    inn:row.i||clean,
    ogrn:row.o||'',
    kpp:row.p||'',
    address:row.rn?String(row.rn).replace(/^Г\.\s*/,''):'',
    director
  };
}
function pickApiFnsAddress(addr){
  if(!addr) return '';
  if(typeof addr==='string') return addr.trim();
  if(addr.АдресПолн && typeof addr.АдресПолн==='string') return addr.АдресПолн.trim();
  const parts=[];
  const push=v=>{ if(v&&String(v).trim()) parts.push(String(v).trim()); };
  if(addr.АдресПолнФИАС && typeof addr.АдресПолнФИАС==='object'){
    Object.values(addr.АдресПолнФИАС).forEach(push);
  }
  if(addr.АдресДетали && typeof addr.АдресДетали==='object'){
    ['Регион','Город','Район','НаселПункт','Улица'].forEach(k=>{
      const x=addr.АдресДетали[k];
      if(x&&typeof x==='object'&&x.Наим) push(x.Наим);
      else push(x);
    });
    push(addr.АдресДетали.Дом);
    push(addr.АдресДетали.Корпус);
    push(addr.АдресДетали.Кварт);
  }
  return parts.join(', ');
}
async function lookupPartyByInnApiFns(inn, key){
  const clean=String(inn||'').replace(/\D/g,'');
  const url=`https://api-fns.ru/api/egr?req=${encodeURIComponent(clean)}&key=${encodeURIComponent(key)}`;
  const res=await fetch(url);
  const text=await res.text();
  if(!res.ok) throw new Error('API-ФНС: '+text.slice(0,160));
  let data;
  try{ data=JSON.parse(text); }catch(_){ throw new Error('API-ФНС: неверный ответ'); }
  if(data.error) throw new Error(String(data.error));
  const item=(data.items&&data.items[0])||null;
  if(!item) throw new Error('По ИНН ничего не найдено (API-ФНС)');
  if(item.ЮЛ){
    const ul=item.ЮЛ;
    return {
      name:ul.НаимСокрЮЛ||ul.НаимПолнЮЛ||'',
      inn:ul.ИНН||clean,
      ogrn:ul.ОГРН||'',
      kpp:ul.КПП||'',
      address:pickApiFnsAddress(ul.Адрес),
      director:(ul.Руководитель&&ul.Руководитель.ФИОПолн)||''
    };
  }
  if(item.ИП){
    const ip=item.ИП;
    const fio=ip.ФИОПолн||ip.ФИОПолнЗАГС||'';
    return {
      name:fio?('ИП '+fio):'ИП',
      inn:ip.ИННФЛ||clean,
      ogrn:ip.ОГРНИП||'',
      kpp:'',
      address:pickApiFnsAddress(ip.Адрес),
      director:fio
    };
  }
  throw new Error('API-ФНС: неизвестный формат ответа');
}
async function lookupPartyByInn(inn){
  const clean=String(inn||'').replace(/\D/g,'');
  if(!isValidInn(clean)) throw new Error('Некорректный ИНН');
  const fnsKey=String((state.settings&&state.settings.fnsApiKey)||'').trim();
  const dadataToken=String((state.settings&&state.settings.dadataToken)||'').trim();
  if(fnsKey){
    try{ return await lookupPartyByInnApiFns(clean, fnsKey); }
    catch(err){ console.warn('API-ФНС', err); }
  }
  try{ return await lookupPartyByInnEgrul(clean); }
  catch(egrulErr){
    if(dadataToken){
      try{ return await lookupPartyByInnDaData(clean, dadataToken); }
      catch(_){ throw egrulErr; }
    }
    throw egrulErr;
  }
}
function networkSlow(){
  try{
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(!c) return false;
    if(c.saveData) return true;
    const t=c.effectiveType;
    return t==='slow-2g'||t==='2g'||t==='3g';
  }catch(_){ return false; }
}
function autoSyncIntervalMs(){
  return networkSlow()?AUTO_SYNC_SLOW_MS:AUTO_SYNC_MS;
}
async function fetchWithTimeout(url, options, timeoutMs){
  const ms=timeoutMs||FETCH_TIMEOUT_MS;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(), ms);
  try{
    return await fetch(url, {...(options||{}), signal:ctrl.signal});
  }finally{ clearTimeout(timer); }
}
function persistLocalOnly(){
  try{
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
    if(currentAdmin) saveAdminSession();
    if(typeof armadaSyncBroadcast==='function') armadaSyncBroadcast('local_save');
  }catch(err){ console.warn('local persist', err); }
}
function pushServerStateQueued(){
  if(syncPushInFlight){
    syncPushQueued=true;
    return syncPushInFlight;
  }
  syncPushInFlight=pushServerState()
    .catch(err=>{ throw err; })
    .finally(()=>{
      syncPushInFlight=null;
      if(syncPushQueued){
        syncPushQueued=false;
        pushServerStateQueued();
      }
    });
  return syncPushInFlight;
}
function armadaApiToken(){
  try{ return localStorage.getItem(ARMADA_API_TOKEN_KEY)||''; }catch(_){ return ''; }
}
function setArmadaApiToken(token){
  try{
    if(token) localStorage.setItem(ARMADA_API_TOKEN_KEY, token);
    else localStorage.removeItem(ARMADA_API_TOKEN_KEY);
  }catch(_){}
}
function armadaApiJsonHeaders(){
  const h={ Accept:'application/json', 'Content-Type':'application/json' };
  const t=armadaApiToken();
  if(t) h.Authorization='Bearer '+t;
  return h;
}
async function armadaApiLogin(pin, meta){
  if(!API_BASE || !pin) return null;
  try{
    const res=await fetchWithTimeout(`${API_BASE}/auth/login`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Accept:'application/json' },
      body:JSON.stringify({ pin, role:'admin', adminId:meta&&meta.id, spaceId:meta&&meta.spaceId })
    }, 8000);
    const data=await res.json().catch(()=>({}));
    if(res.ok && data.token){ setArmadaApiToken(data.token); return data.token; }
  }catch(err){ console.warn('armada-api login', err); }
  return null;
}
async function fetchServerStateFromApi(timeoutMs){
  const res=await fetchWithTimeout(`${API_BASE}/state`, { headers:armadaApiJsonHeaders() }, timeoutMs);
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||'API state '+res.status);
  if(!data.payload) return null;
  return { id:data.recordId, payload:data.payload, viaApi:true };
}
async function fetchServerStateFromPb(timeoutMs){
  const filter=encodeURIComponent("key='main'");
  const res=await fetchWithTimeout(`${PB_BASE}/api/collections/app_state/records?filter=${filter}&perPage=1`, {}, timeoutMs);
  if(!res.ok) throw new Error('Не удалось загрузить базу ('+res.status+')');
  const data=await res.json();
  return (data.items&&data.items[0])||null;
}
async function fetchServerState(timeoutMs){
  if(API_BASE){
    try{ return await fetchServerStateFromApi(timeoutMs); }
    catch(err){ console.warn('API state fetch, fallback PB', err); }
  }
  return await fetchServerStateFromPb(timeoutMs);
}
async function patchServerStatePayload(payload){
  if(API_BASE){
    try{
      const res=await fetchWithTimeout(`${API_BASE}/state`, {
        method:'PATCH',
        headers:armadaApiJsonHeaders(),
        body:JSON.stringify({ payload })
      });
      const data=await res.json().catch(()=>({}));
      if(res.status===409){
        return { ok:false, aborted:true, remotePayload:data.payload, remoteEpoch:data.remoteEpoch, viaApi:true };
      }
      if(!res.ok) throw new Error(data.error||'API patch '+res.status);
      if(data.recordId) pbRecordId=data.recordId;
      return { ok:true, aborted:false, viaApi:true };
    }catch(err){ console.warn('API patch fallback PB', err); }
  }
  const body={ key:'main', payload };
  if(pbRecordId){
    const res=await fetchWithTimeout(`${PB_BASE}/api/collections/app_state/records/${pbRecordId}`,{
      method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    if(!res.ok) throw new Error('Не удалось сохранить ('+res.status+')');
    return { ok:true, aborted:false };
  }
  const res=await fetchWithTimeout(`${PB_BASE}/api/collections/app_state/records`,{
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  if(res.ok){
    const rec=await res.json();
    pbRecordId=rec.id;
    return { ok:true, aborted:false };
  }
  const existing=await fetchServerStateFromPb();
  if(!existing) throw new Error('Не удалось создать запись базы');
  pbRecordId=existing.id;
  const res2=await fetchWithTimeout(`${PB_BASE}/api/collections/app_state/records/${pbRecordId}`,{
    method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  if(!res2.ok) throw new Error('Не удалось сохранить ('+res2.status+')');
  return { ok:true, aborted:false };
}
async function pushServerState(){
  // Перед записью сверяем эпоху (с таймаутом — при плохой сети не блокируемся).
  try{
    const rec=await fetchServerState(FETCH_PREFLIGHT_MS);
    if(rec){
      pbRecordId=rec.id;
      const remote=rec.payload||{};
      // tombstone только расширяем — старая вкладка не должна очищать удалённые id
      unionDeletedOrderIds(remote.deletedOrderIds||[]);
      state.orders=stripCancelledFromOrders(state.orders);
      (state.shifts||[]).forEach(s=>{ if(Array.isArray(s.orders)) s.orders=stripCancelledFromOrders(s.orders); });
      const remoteEpoch=Number(remote.dataEpoch)||0;
      const localEpoch=Number(state.dataEpoch)||0;
      if(remoteEpoch>localEpoch){
        const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
        const localOrders=(state.orders||[]).map(o=>structuredClone(o));
        const liveShift=state.shift && !state.shift.endedAt ? structuredClone(state.shift) : null;
        // Сначала сервер, потом аккуратно вернём локальный прогресс ЕТО/заказов
        applyPayload(remote, {remoteSeq:true});
        let merged=false;
        if(mergeLocalShifts(localShifts)) merged=true;
        if(liveShift && mergeLocalShifts([liveShift])) merged=true;
        if(mergeLocalOrders(localOrders)) merged=true;
        if(healOrphanOrdersIntoShifts()) merged=true;
        if(migrateEtoFromMessages()) merged=true;
        if(merged){
          bumpDataEpoch('merge-local-remote-ahead');
          localStorage.setItem(KEY, JSON.stringify(snapshot()));
          try{
            await patchServerStatePayload(snapshot());
            console.warn('push merged local into remote epoch', remoteEpoch);
            return {aborted:false, merged:true};
          }catch(e){ console.warn('merge push', e); }
        } else {
          localStorage.setItem(KEY, JSON.stringify(snapshot()));
        }
        console.warn('PB push aborted: remote epoch ahead', remoteEpoch, '>', localEpoch);
        return {aborted:true, reason:'remote_ahead'};
      }
    }
  }catch(err){
    console.warn('PB preflight', err);
  }
  const payload=snapshot();
  localStorage.setItem(KEY, JSON.stringify(payload));
  const pushed=await patchServerStatePayload(payload);
  if(pushed.ok) return {aborted:false};
  if(pushed.aborted) return {aborted:true, reason:'remote_ahead'};
  throw new Error('Не удалось сохранить');
}
function persist(){
  persistLocalOnly();
  if(navigator.onLine===false){
    syncStatus='error';
    updateDriverNetHint();
    if(typeof updateSyncHint==='function') updateSyncHint();
    return;
  }
  clearTimeout(persistTimer);
  persistTimer=setTimeout(()=>{
    syncStatus='syncing';
    updateDriverNetHint();
    if(typeof updateSyncHint==='function') updateSyncHint();
    pushServerStateQueued()
      .then(()=>{ syncStatus='ok'; pullFailCount=0; updateDriverNetHint(); if(typeof updateSyncHint==='function') updateSyncHint(); })
      .catch(err=>{ syncStatus='error'; console.warn('PB sync', err); updateDriverNetHint(); if(typeof updateSyncHint==='function') updateSyncHint(); });
  }, PERSIST_DEBOUNCE_MS);
}
async function initCloudSync(){
  syncStatus='syncing';
  try{
    const rec=await fetchServerState();
    if(rec){
      pbRecordId=rec.id;
      const remote=rec.payload||{};
      const remoteEpoch=Number(remote.dataEpoch)||0;
      const localEpoch=Number(state.dataEpoch)||0;
      // Сервер — источник правды при старте, если эпоха не ниже локальной.
      // Раньше при равной эпохе «более новый» localStorage затирал очистку на сервере.
      if(remoteEpoch>=localEpoch || !localEpoch){
        const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
        const localOrders=(state.orders||[]).map(o=>structuredClone(o));
        applyPayload(remote, {keepShifts:localShifts, keepOrders:localOrders, remoteSeq:true});
        healOrphanOrdersIntoShifts();
        migrateEtoFromMessages();
        localStorage.setItem(KEY, JSON.stringify(snapshot()));
      } else {
        // Локальная эпоха строго выше — осознанная очистка/миграция с этого устройства.
        await pushServerState();
      }
    } else {
      await pushServerState();
    }
    syncStatus='ok';
  }catch(err){
    syncStatus='error';
    console.warn('PB init', err);
  }
}
/** Подтянуть новую эпоху с сервера без перезагрузки и без повторного PIN. */
async function pullRemoteUpdates(reason){
  if(autoSyncBusy) return false;
  if(!navigator.onLine) return false;
  if(Date.now()<pullBackoffUntil) return false;
  // Не мешаем активному вводу закрытия/создания — только если шаг idle или просмотр
  const busyStep=state.orderStep&&state.orderStep!=='idle'&&state.orderStep!=='postCloseWhere';
  if(busyStep && reason==='poll') return false;
  autoSyncBusy=true;
  try{
    const rec=await fetchServerState();
    if(!rec) return false;
    pbRecordId=rec.id;
    const remote=rec.payload||{};
    const remoteEpoch=Number(remote.dataEpoch)||0;
    const localEpoch=Number(state.dataEpoch)||0;
    if(remoteEpoch<=localEpoch) return false;
    const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
    const localOrders=(state.orders||[]).map(o=>structuredClone(o));
    const liveShift=state.shift && !state.shift.endedAt ? structuredClone(state.shift) : null;
    const inDriver=!!DRIVER && !!document.querySelector('#driver.show');
    const inAdmin=!!currentAdmin && !inDriver;
    const detailId=state.detailId;
    const keepStep=state.orderStep;
    const keepDraft=state.draft?structuredClone(state.draft):{};
    const keepMessages=(state.messages||[]).slice();
    const keepUiStep=state.step;
    const ordersOpen=!!document.querySelector('#orders-panel.show');
    const cabinetOpen=!!document.querySelector('#cabinet-panel.show');
    applyPayload(remote, {remoteSeq:true});
    mergeLocalShifts(localShifts);
    if(liveShift) mergeLocalShifts([liveShift]);
    mergeLocalOrders(localOrders);
    healOrphanOrdersIntoShifts();
    migrateEtoFromMessages();
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
    if(inDriver){
      // не поднимаем currentAdmin поверх режима водителя
      const open=findOpenShift();
      if(open){
        state.shift=open;
        // Чат: берём более полную историю (локальная или сменная)
        const shiftMsgs=(open.messages&&open.messages.length)?open.messages.slice():[];
        const richer=keepMessages.length>shiftMsgs.length?keepMessages:shiftMsgs;
        if(keepStep && keepStep!=='idle'){
          state.orderStep=keepStep;
          state.draft=keepDraft;
          state.step=keepUiStep||'done';
          state.messages=richer.length?richer:keepMessages;
        } else {
          state.messages=richer.length?richer:keepMessages;
          state.step=isEtoDone(open)?'done':(keepUiStep||'idle');
          restoreOrderWorkflow(open);
        }
        // обратно в смену — чтобы не отвалилось при следующем sync
        open.messages=state.messages.slice();
      }
      renderChat(); renderInput(); renderDriverBanner();
      if(ordersOpen) showOrders();
      if(cabinetOpen) showCabinet();
    } else if(inAdmin){
      restoreAdminSession();
      if(detailId && (state.orders||[]).some(o=>o.id===detailId)) openDetail(detailId);
      else if(document.querySelector('#admin-vehicle-card.show') && state._vehicleCardId) openVehicleCard(state._vehicleCardId);
      else if(document.querySelector('#admin-catalogs-screen.show')) openCatalogs();
      else if(document.querySelector('#admin.show')) renderAdmin();
    } else if(typeof currentCustomer!=='undefined' && currentCustomer || document.querySelector('#customer-portal.show')){
      if(typeof restoreCustomerSession==='function') restoreCustomerSession();
      if(typeof renderCustomerPortal==='function') renderCustomerPortal();
      if(typeof maybeNotifyCustomerOrderUpdates==='function') maybeNotifyCustomerOrderUpdates();
    }
    syncStatus='ok';
    pullFailCount=0;
    pullBackoffUntil=0;
    updateSyncHint();
    console.info('auto-sync', reason, 'epoch', remoteEpoch);
    return true;
  }catch(err){
    syncStatus='error';
    pullFailCount=Math.min(pullFailCount+1, 12);
    pullBackoffUntil=Date.now()+Math.min(SYNC_BACKOFF_MAX_MS, 4000*pullFailCount);
    updateSyncHint();
    console.warn('auto-sync', reason, err);
    return false;
  }finally{
    autoSyncBusy=false;
  }
}
function stopAutoSync(){
  if(autoSyncTimer){ clearTimeout(autoSyncTimer); autoSyncTimer=null; }
}
function startAutoSync(){
  stopAutoSync();
  const tick=()=>{
    if(!document.hidden) pullRemoteUpdates('poll');
    autoSyncTimer=setTimeout(tick, autoSyncIntervalMs());
  };
  autoSyncTimer=setTimeout(tick, autoSyncIntervalMs());
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) stopAutoSync();
    else startAutoSync();
  });
  let syncStorageTimer=null;
  window.addEventListener('storage', (e)=>{
    if(e.key!==KEY || !e.newValue) return;
    clearTimeout(syncStorageTimer);
    syncStorageTimer=setTimeout(()=>{
      try{
        const parsed=JSON.parse(e.newValue);
        const remoteEpoch=Number(parsed.dataEpoch)||0;
        const localEpoch=Number(state.dataEpoch)||0;
        if(remoteEpoch<=localEpoch) return;
        unionDeletedOrderIds(parsed.deletedOrderIds||[]);
        const localShifts=(state.shifts||[]).map(s=>structuredClone(s));
        const localOrders=(state.orders||[]).map(o=>structuredClone(o));
        const liveShift=state.shift && !state.shift.endedAt ? structuredClone(state.shift) : null;
        applyPayload(parsed, {remoteSeq:true});
        if(typeof mergeLocalShifts==='function'){
          mergeLocalShifts(localShifts);
          if(liveShift) mergeLocalShifts([liveShift]);
        }
        if(typeof mergeLocalOrders==='function') mergeLocalOrders(localOrders);
        if(typeof healOrphanOrdersIntoShifts==='function') healOrphanOrdersIntoShifts();
        if(typeof migrateEtoFromMessages==='function') migrateEtoFromMessages();
        localStorage.setItem(KEY, JSON.stringify(snapshot()));
        syncStatus='ok';
        if(typeof updateSyncHint==='function') updateSyncHint();
        if(typeof updateDriverNetHint==='function') updateDriverNetHint();
        if(currentAdmin && typeof renderAdmin==='function') renderAdmin();
        if(DRIVER && typeof renderDriverBanner==='function') renderDriverBanner();
        if(typeof maybeNotifyCustomerOrderUpdates==='function') maybeNotifyCustomerOrderUpdates();
        if(typeof currentCustomer!=='undefined' && currentCustomer && typeof renderCustomerPortal==='function') renderCustomerPortal();
      }catch(err){ console.warn('storage-tab sync', err); }
    }, 120);
  });
}
const ARMADA_SYNC_BC='armada_sync_v1';
let armadaSyncChannel=null;
function armadaSyncBroadcast(kind){
  try{
    if(!armadaSyncChannel && typeof BroadcastChannel!=='undefined'){
      armadaSyncChannel=new BroadcastChannel(ARMADA_SYNC_BC);
      armadaSyncChannel.onmessage=(ev)=>{
        const d=ev&&ev.data;
        if(!d || d.type!=='state_touch') return;
        if(d.epoch && Number(d.epoch)<=Number(state.dataEpoch||0)) return;
        pullRemoteUpdates('broadcast');
      };
    }
    if(armadaSyncChannel) armadaSyncChannel.postMessage({type:'state_touch', epoch:state.dataEpoch, kind});
  }catch(_){}
}
