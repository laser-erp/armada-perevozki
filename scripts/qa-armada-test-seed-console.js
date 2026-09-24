/**
 * Создание тестовых учёток QA в кабинете ООО «Армада» (только staging/prod — общая база).
 * Во всех названиях обязательно «ТЕСТ».
 *
 * Как запустить:
 * 1. Войти на https://staging.app.armada.sx/a/ как логист Армады.
 * 2. F12 → Console → вставить содержимое этого файла целиком → Enter.
 * 3. Выполнить: armadaQaSeedTestAccounts()
 */
(function (global) {
  const QA = {
    driverName: 'Водитель ТЕСТ QA',
    driverPhone: '+79009009001',
    driverPin: '9001',
    vehiclePlate: 'А000ТЕ99',
    vehicleLabel: 'Машина ТЕСТ QA',
    customerName: 'Заказчик ТЕСТ QA',
    portalPhone: '+79009009002',
    portalPin: '9002',
    contactName: 'Контакт ТЕСТ QA',
  };

  function hasTestMarker(s) {
    return String(s || '').toUpperCase().includes('ТЕСТ');
  }

  async function armadaQaSeedTestAccounts() {
    if (!global.currentAdmin) {
      alert('Сначала войдите в кабинет логиста (/a) под ООО «Армада».');
      return { ok: false, reason: 'not_logged_in' };
    }
    const arm =
      typeof global.findArmadaLogistCompany === 'function'
        ? global.findArmadaLogistCompany()
        : null;
    if (!arm || !arm.id) {
      alert('В базе нет ООО «Армада» — seed невозможен.');
      return { ok: false, reason: 'no_armada' };
    }
    const owner =
      typeof global.resolveAdminOwner === 'function'
        ? global.resolveAdminOwner(global.currentAdmin.id)
        : {};
    const spaceId = arm.spaceId || owner.spaceId || null;
    const companyId = arm.id;
    const companyName = arm.name || 'ООО «Армада»';
    const fmt =
      typeof global.formatPhone === 'function'
        ? global.formatPhone
        : (p) => String(p || '').trim();
    const driverPhone = fmt(QA.driverPhone);
    const portalPhone = fmt(QA.portalPhone);

    if (!hasTestMarker(QA.driverName) || !hasTestMarker(QA.customerName)) {
      alert('В конфиге seed нет «ТЕСТ» в названии — проверьте QA.*');
      return { ok: false, reason: 'bad_config' };
    }

    global.state = global.state || {};
    global.state.drivers = global.state.drivers || [];
    global.state.vehicles = global.state.vehicles || [];
    global.state.companies = global.state.companies || [];

    let driver = global.state.drivers.find(
      (d) =>
        d.companyId === companyId &&
        String(d.name || '').includes('ТЕСТ QA') &&
        fmt(d.phone) === driverPhone
    );
    if (!driver) {
      const exists =
        typeof global.driverExistsInCompany === 'function' &&
        global.driverExistsInCompany(QA.driverName, companyId);
      if (exists) {
        driver = global.state.drivers.find(
          (d) => d.companyId === companyId && global.samePersonName(d.name, QA.driverName)
        );
      } else {
        driver = {
          id: global.uuid(),
          name: QA.driverName,
          salaryPercent: 30,
          phone: driverPhone,
          pin: QA.driverPin,
          exchangeEnabled: false,
          ownerAdminId: owner.ownerAdminId,
          ownerAdminName: owner.ownerAdminName,
          spaceId,
          companyId,
          companyName,
        };
        global.state.drivers.push(driver);
      }
    } else if (!driver.pin) {
      driver.pin = QA.driverPin;
    }

    let vehicle = global.state.vehicles.find(
      (v) =>
        v.companyId === companyId &&
        String(v.plate || '').toUpperCase() === QA.vehiclePlate.toUpperCase()
    );
    if (!vehicle) {
      const norm =
        typeof global.normalizeFleetVehicle === 'function'
          ? global.normalizeFleetVehicle
          : (v) => v;
      vehicle = norm({
        plate: QA.vehiclePlate,
        makeModel: QA.vehicleLabel,
        consumptionPer100Km: 22,
        payloadTons: 20,
        bodyTypeId: 'tent',
        spaceId,
        companyId,
        companyName,
        serviceIntervals: [],
        maintenanceLogs: [],
      });
      if (vehicle) global.state.vehicles.push(vehicle);
    } else if (!vehicle.makeModel || !hasTestMarker(vehicle.makeModel)) {
      vehicle.makeModel = QA.vehicleLabel;
    }

    let customer = global.state.companies.find(
      (c) =>
        Array.isArray(c.roles) &&
        c.roles.includes('customer') &&
        c.spaceId === spaceId &&
        String(c.name || '').includes('ТЕСТ QA')
    );
    if (!customer) {
      customer = {
        id: global.uuid(),
        name: QA.customerName,
        roles: ['customer'],
        spaceId,
        inn: '',
        note: 'QA lifecycle · только тесты · удалить по согласованию',
        portalEnabled: true,
        portalPhone,
        portalPin: QA.portalPin,
        loadingAddresses: ['Москва, ул. Тестовая, 1'],
        unloadingAddresses: ['Москва, ул. Выгрузки, 2'],
        contacts: [{ name: QA.contactName, phone: portalPhone, role: '' }],
        phones: [portalPhone],
        vehicles: [],
        drivers: [],
      };
      global.state.companies.push(customer);
      global.state.companies.sort((a, b) =>
        String(a.name).localeCompare(String(b.name), 'ru')
      );
    } else {
      customer.portalEnabled = true;
      customer.portalPhone = portalPhone;
      customer.portalPin = QA.portalPin;
      if (!hasTestMarker(customer.name)) customer.name = QA.customerName;
    }

    if (typeof global.syncCustomersFromCompanies === 'function') {
      global.syncCustomersFromCompanies();
    }
    if (typeof global.bumpDataEpoch === 'function') {
      global.bumpDataEpoch('qa-seed-test-accounts');
    }
    if (typeof global.persist === 'function') global.persist();
    if (typeof global.pushServerStateQueued === 'function') {
      try {
        await global.pushServerStateQueued();
      } catch (e) {
        console.warn('pushServerStateQueued', e);
      }
    }

    const cred = {
      ok: true,
      space: companyName,
      logist: 'Ваш текущий вход /a (PIN не менялся)',
      driver: {
        url: 'https://staging.app.armada.sx/v/',
        name: driver.name,
        phone: driverPhone,
        pin: driver.pin || QA.driverPin,
      },
      vehicle: { plate: QA.vehiclePlate, label: QA.vehicleLabel },
      customerPortal: {
        url: 'https://staging.app.armada.sx/z/',
        company: customer.name,
        phone: portalPhone,
        pin: QA.portalPin,
      },
      orderFormPhone: driverPhone,
    };
    console.info('АРМАДА QA seed готово', cred);
    alert(
      'ТЕСТ-учётки созданы/обновлены.\n\n' +
        'Водитель: ' +
        driverPhone +
        ' PIN ' +
        (driver.pin || QA.driverPin) +
        '\n' +
        'Машина: ' +
        QA.vehiclePlate +
        '\n' +
        'Портал заказчика: ' +
        portalPhone +
        ' PIN ' +
        QA.portalPin +
        '\n\nПодробности — в консоли (объект cred).'
    );
    return cred;
  }

  global.armadaQaSeedTestAccounts = armadaQaSeedTestAccounts;
  global.armadaQaTestCredentials = QA;
})(typeof window !== 'undefined' ? window : globalThis);
