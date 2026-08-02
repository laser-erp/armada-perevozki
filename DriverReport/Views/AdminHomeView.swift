import SwiftUI

struct AdminHomeView: View {
    @ObservedObject var store: ShiftStore
    let onExit: () -> Void
    @State private var filter: StatusFilter = .all

    enum StatusFilter: String, CaseIterable, Identifiable {
        case all = "Все"
        case assigned = "Назначен"
        case progress = "В работе"
        case closed = "Закрыт"
        var id: String { rawValue }
    }

    private var filtered: [OrderRecord] {
        store.allOrders().filter { order in
            switch filter {
            case .all: return true
            case .assigned: return order.isAssignedPending
            case .progress: return order.isInProgress
            case .closed: return order.isClosed
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(colors: [AppTheme.canvasTop, AppTheme.canvasBottom], startPoint: .top, endPoint: .bottom)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    Picker("Фильтр", selection: $filter) {
                        ForEach(StatusFilter.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .padding(12)

                    Text("Нажмите строку заявки → поля ставок и финансов")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(AppTheme.textMuted)
                        .padding(.horizontal, 12)

                    if filtered.isEmpty {
                        Spacer()
                        Text("Нет заявок")
                            .foregroundStyle(AppTheme.textMuted)
                        Spacer()
                    } else {
                        ScrollView([.horizontal, .vertical]) {
                            VStack(alignment: .leading, spacing: 0) {
                                headerRow
                                ForEach(filtered) { order in
                                    NavigationLink {
                                        AdminOrderDetailView(store: store, orderId: order.id)
                                    } label: {
                                        dataRow(order)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.bottom, 24)
                        }
                    }
                }
            }
            .navigationTitle("Таблица заявок")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Выход", action: onExit).foregroundStyle(AppTheme.accent)
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    NavigationLink {
                        AdminCatalogView(store: store)
                    } label: {
                        Text("Справочники").foregroundStyle(AppTheme.accent)
                    }
                    NavigationLink {
                        AdminCreateOrderView(store: store)
                    } label: {
                        Image(systemName: "plus.circle.fill").foregroundStyle(AppTheme.accent)
                    }
                }
            }
        }
        .tint(AppTheme.accent)
    }

    private var columns: [String] {
        [
            "Дата", "Госномер", "Водитель", "Заказчик", "Маршрут", "№ дня",
            "Нулевой", "С грузом", "До стоянки", "Общий день",
            "₽/л", "₽/км нал", "С НДС", "Без НДС", "Нал", "Доплата ЗП",
            "ГСМ л", "₽/км без НДС", "ГСМ ₽", "Аренда", "Подушка", "Прибыль", "№ базы"
        ]
    }

    private var headerRow: some View {
        HStack(spacing: 0) {
            ForEach(columns, id: \.self) { col in
                Text(col)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundStyle(AppTheme.accent)
                    .frame(width: width(for: col), alignment: .leading)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 6)
            }
        }
        .background(AppTheme.botBubble)
    }

    private func dataRow(_ order: OrderRecord) -> some View {
        let m = store.metrics(for: order)
        return HStack(spacing: 0) {
            cell(Self.df.string(from: order.createdAt), "Дата")
            cell(order.vehiclePlate, "Госномер")
            cell(order.driverName, "Водитель")
            cell(order.customer.isEmpty ? "—" : order.customer, "Заказчик")
            cell(order.routeText, "Маршрут")
            cell("\(order.dayNumber)", "№ дня")
            cell(num(order.emptyKmBefore), "Нулевой")
            cell(num(order.loadedKm), "С грузом")
            cell(num(order.emptyKmAfter), "До стоянки")
            cell(num(order.dayTotalKm), "Общий день")
            cell(dec(order.fuelPricePerLiter), "₽/л")
            cell(dec(order.ratePerKmCash), "₽/км нал")
            cell(dec(order.rateWithVat), "С НДС")
            cell(dec(order.rateWithoutVat), "Без НДС")
            cell(dec(order.rateCash), "Нал")
            cell(dec(order.salaryBonus), "Доплата ЗП")
            cell(dec(m.fuelLitersCalc), "ГСМ л")
            cell(dec(m.costPerKmNoVat), "₽/км без НДС")
            cell(dec(m.fuelCostCalc), "ГСМ ₽")
            cell(dec(order.vehicleRent), "Аренда")
            cell(dec(m.cushion), "Подушка")
            cell(dec(m.netProfit), "Прибыль")
            cell("\(order.sequentialNumber)", "№ базы")
        }
        .background(AppTheme.field.opacity(0.35))
        .overlay(Rectangle().stroke(Color.white.opacity(0.06), lineWidth: 1))
    }

    private func cell(_ text: String, _ col: String) -> some View {
        Text(text)
            .font(.system(size: 11, design: .rounded))
            .foregroundStyle(AppTheme.textPrimary)
            .lineLimit(2)
            .frame(width: width(for: col), alignment: .leading)
            .padding(.vertical, 8)
            .padding(.horizontal, 6)
    }

    private func width(for col: String) -> CGFloat {
        switch col {
        case "Маршрут": return 180
        case "Дата": return 110
        case "Госномер", "Водитель", "Заказчик": return 120
        default: return 88
        }
    }

    private func num(_ v: Int?) -> String { v.map(String.init) ?? "—" }
    private func dec(_ v: Double?) -> String {
        guard let v else { return "—" }
        return v.rounded() == v ? String(Int(v)) : String(format: "%.2f", v)
    }

    private static let df: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "dd.MM.yyyy HH:mm"
        return f
    }()
}

struct AdminCreateOrderView: View {
    @ObservedObject var store: ShiftStore
    @Environment(\.dismiss) private var dismiss

    @State private var dayNumber = 1
    @State private var plate = FleetCatalog.plates[0]
    @State private var driver = AppDefaults.driverName
    @State private var customer = ""
    @State private var loading = ""
    @State private var unloading = ""
    @State private var error: String?

    private var selectedCustomer: CustomerProfile? {
        store.customer(for: customer)
    }

    var body: some View {
        Form {
            Section("Назначение") {
                Picker("Номер за день", selection: $dayNumber) {
                    ForEach(1...5, id: \.self) { Text("\($0)").tag($0) }
                }
                Picker("Водитель", selection: $driver) {
                    ForEach(store.drivers.map(\.name), id: \.self) { Text($0).tag($0) }
                }
                Picker("Автомобиль", selection: $plate) {
                    ForEach(store.vehicles.map(\.plate), id: \.self) { Text($0).tag($0) }
                }
                TextField("Заказчик", text: $customer)
                if !store.customerNames().isEmpty {
                    Menu("Выбрать заказчика") {
                        ForEach(store.customerNames(), id: \.self) { name in
                            Button(name) { customer = name }
                        }
                    }
                }
            }
            Section("Маршрут") {
                TextField("Адрес загрузки", text: $loading, axis: .vertical)
                if let loads = selectedCustomer?.loadingAddresses, !loads.isEmpty {
                    Menu("Из сохранённых загрузок") {
                        ForEach(loads, id: \.self) { addr in
                            Button(addr) { loading = addr }
                        }
                    }
                }
                TextField("Адрес выгрузки", text: $unloading, axis: .vertical)
                if let unloads = selectedCustomer?.unloadingAddresses, !unloads.isEmpty {
                    Menu("Из сохранённых выгрузок") {
                        ForEach(unloads, id: \.self) { addr in
                            Button(addr) { unloading = addr }
                        }
                    }
                }
            }
            if let error { Text(error).foregroundStyle(.red).font(.caption) }
            Button("Назначить водителю") {
                let load = loading.trimmingCharacters(in: .whitespacesAndNewlines)
                let unload = unloading.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !load.isEmpty, !unload.isEmpty else {
                    error = "Заполните оба адреса"
                    return
                }
                _ = store.createDispatcherOrder(
                    dayNumber: dayNumber,
                    vehiclePlate: plate,
                    driverName: driver,
                    customer: customer.trimmingCharacters(in: .whitespacesAndNewlines),
                    loadingAddress: load,
                    unloadingAddress: unload
                )
                dismiss()
            }
            .foregroundStyle(AppTheme.accent)
        }
        .scrollContentBackground(.hidden)
        .background(AppTheme.canvasTop)
        .navigationTitle("Новый заказ")
        .onAppear {
            if !store.vehicles.contains(where: { $0.plate == plate }) {
                plate = store.vehicles.first?.plate ?? plate
            }
            if !store.drivers.contains(where: { $0.name == driver }) {
                driver = store.drivers.first?.name ?? driver
            }
        }
    }
}

struct AdminOrderDetailView: View {
    @ObservedObject var store: ShiftStore
    let orderId: UUID

    @State private var customer = ""
    @State private var routePoints: [RoutePoint] = OrderRecord.defaultRoutePoints(loading: "", unloading: "")
    @State private var paymentForm: PaymentForm = .cash
    @State private var ratePerKmCash = ""
    @State private var estimateKm = ""
    @State private var ratePerHourWork = ""
    @State private var estimateWorkHours = ""
    @State private var workHours = ""
    @State private var rateWithVat = ""
    @State private var rateWithoutVat = ""
    @State private var rateCash = ""
    @State private var salaryBonus = ""
    @State private var vehicleRent = ""
    @State private var emptyKmAfter = ""
    @State private var saved = false
    @State private var syncingRates = false
    @State private var routeError: String?
    @State private var tariffSummary = ""

    private var order: OrderRecord? {
        store.allOrders().first { $0.id == orderId }
    }

    private var routePreview: String {
        routePoints
            .map { point in
                let addr = point.address.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !addr.isEmpty else { return nil as String? }
                return "\(point.kind.titleRu): \(addr)"
            }
            .compactMap { $0 }
            .joined(separator: " → ")
    }

    var body: some View {
        Group {
            if let order {
                let m = store.metrics(for: order)
                Form {
                    Section("Заявка") {
                        row("№ базы", "\(order.sequentialNumber)")
                        row("№ за день", "\(order.dayNumber)")
                        row("Статус", order.statusText)
                        row("Водитель", "\(order.driverName) (% \(Int(order.driverPercent)))")
                        row("Авто", order.vehiclePlate)
                        TextField("Заказчик", text: $customer)
                        if !store.customerNames().isEmpty {
                            Menu("Выбрать заказчика") {
                                ForEach(store.customerNames(), id: \.self) { name in
                                    Button(name) { customer = name }
                                }
                            }
                        }
                    }
                    Section("Маршрут") {
                        Text("У каждой точки тип: загрузка или выгрузка. Можно менять тип, адрес и порядок (↑ ↓). Адреса заказчика запоминаются.")
                            .font(.system(.caption2, design: .rounded))
                            .foregroundStyle(AppTheme.textMuted)
                        if !routePreview.isEmpty {
                            Text(routePreview)
                                .font(.system(.caption, design: .rounded))
                                .foregroundStyle(AppTheme.accent)
                        }
                        ForEach(Array(routePoints.enumerated()), id: \.element.id) { index, _ in
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Точка \(index + 1)")
                                    .font(.system(.caption2, design: .rounded))
                                    .foregroundStyle(AppTheme.textMuted)
                                Picker("Тип", selection: $routePoints[index].kind) {
                                    ForEach(RoutePointKind.allCases) { kind in
                                        Text(kind.titleRu).tag(kind)
                                    }
                                }
                                .pickerStyle(.segmented)
                                TextField("Адрес", text: $routePoints[index].address)
                                let suggestions = addressSuggestions(for: routePoints[index].kind)
                                if !suggestions.isEmpty {
                                    Menu("Сохранённые адреса") {
                                        ForEach(suggestions, id: \.self) { addr in
                                            Button(addr) { routePoints[index].address = addr }
                                        }
                                    }
                                }
                                HStack(spacing: 12) {
                                    Button("↑") { movePoint(from: index, by: -1) }
                                        .disabled(index == 0)
                                    Button("↓") { movePoint(from: index, by: 1) }
                                        .disabled(index >= routePoints.count - 1)
                                    Spacer()
                                    if routePoints.count > 2 {
                                        Button("Удалить", role: .destructive) {
                                            routePoints.remove(at: index)
                                        }
                                    }
                                }
                                .font(.system(.caption, design: .rounded))
                            }
                        }
                        Menu {
                            Button("Загрузка") { addPoint(kind: .loading) }
                            Button("Выгрузка") { addPoint(kind: .unloading) }
                        } label: {
                            Text("+ Точка").foregroundStyle(AppTheme.accent)
                        }
                        if let routeError {
                            Text(routeError).foregroundStyle(.red).font(.caption)
                        }
                    }
                    Section("Пробеги") {
                        row("Нулевой до заказа", "\(order.emptyKmBefore.map(String.init) ?? "—") км")
                        row("С грузом", "\(order.loadedKm.map(String.init) ?? "—") км")
                        TextField("Пробег до стоянки, км", text: $emptyKmAfter)
                            .keyboardType(.numberPad)
                            .onChange(of: emptyKmAfter) { _, _ in syncFromTariff() }
                        row("От стоянки до конца", "\(m.kmParkingToEnd.map(String.init) ?? "—") км")
                        row("Общий за день (по полям)", "\(order.dayTotalKm.map(String.init) ?? "—") км")
                    }
                    Section("Тариф клиенту") {
                        Text("Комбо: часы + ₽/км. Город ≤\(store.financeSettings.cityKmThreshold) км: мин. \(format(store.financeSettings.minWorkHours)) ч работы + \(format(store.financeSettings.podachaHours)) ч подачи. Если нулевой × ₽/км > подачи — ₽/км нулевого добавляется.")
                            .font(.system(.caption2, design: .rounded))
                            .foregroundStyle(AppTheme.textMuted)
                        TextField("₽/км наличные", text: $ratePerKmCash)
                            .keyboardType(.decimalPad)
                            .onChange(of: ratePerKmCash) { _, _ in syncFromTariff() }
                        TextField("₽/час работы", text: $ratePerHourWork)
                            .keyboardType(.decimalPad)
                            .onChange(of: ratePerHourWork) { _, _ in syncFromTariff() }
                        TextField("Ориентир км (цепочка)", text: $estimateKm)
                            .keyboardType(.numberPad)
                            .onChange(of: estimateKm) { _, _ in syncFromTariff() }
                        TextField("Ориентир часов работы", text: $estimateWorkHours)
                            .keyboardType(.decimalPad)
                            .onChange(of: estimateWorkHours) { _, _ in syncFromTariff() }
                        TextField("Факт часов работы", text: $workHours)
                            .keyboardType(.decimalPad)
                            .onChange(of: workHours) { _, _ in syncFromTariff() }
                        row("Цепочка км", chainKmLabel(for: order))
                        if !tariffSummary.isEmpty {
                            Text(tariffSummary)
                                .font(.system(.caption, design: .rounded))
                                .foregroundStyle(AppTheme.accent)
                        }
                        if let preview = tariffPreviewTotals(for: order) {
                            row("Сумма нал (расчёт)", "\(format(preview.cash)) ₽")
                            row("Сумма без НДС", "\(format(preview.withoutVat)) ₽")
                            row("Сумма с НДС", "\(format(preview.withVat)) ₽")
                        }
                        Text("ЗП, подушка и прибыль считаются всегда от ставки наличные.")
                            .font(.system(.caption2, design: .rounded))
                            .foregroundStyle(AppTheme.textMuted)
                        Picker("Форма для клиента (документы)", selection: $paymentForm) {
                            ForEach(PaymentForm.allCases) { Text($0.rawValue).tag($0) }
                        }
                        TextField("Ставка с НДС", text: $rateWithVat)
                            .keyboardType(.decimalPad)
                            .onChange(of: rateWithVat) { _, new in syncRates(from: .withVat, text: new) }
                        TextField("Ставка без НДС", text: $rateWithoutVat)
                            .keyboardType(.decimalPad)
                            .onChange(of: rateWithoutVat) { _, new in syncRates(from: .withoutVat, text: new) }
                        TextField("Ставка наличные", text: $rateCash)
                            .keyboardType(.decimalPad)
                            .onChange(of: rateCash) { _, new in syncRates(from: .cash, text: new) }
                        TextField("Доплата к ЗП", text: $salaryBonus).keyboardType(.decimalPad)
                        TextField("Аренда ТС", text: $vehicleRent).keyboardType(.decimalPad)
                    }
                    Section("Расчёты") {
                        row("Норма авто", "\(format(m.consumptionPer100)) л/100км")
                        row("ГСМ по заказу", "\(m.fuelLitersCalc.map(format) ?? "—") л")
                        row("₽/л (факт)", order.fuelPricePerLiter.map(format) ?? "—")
                        row("Стоимость ГСМ", m.fuelCostCalc.map { "\(format($0)) ₽" } ?? "—")
                        row("₽/км без НДС", m.costPerKmNoVat.map(format) ?? "—")
                        row("Подушка 10%", m.cushion.map { "\(format($0)) ₽" } ?? "—")
                        row("ЗП водителя", m.driverPay.map { "\(format($0)) ₽" } ?? "—")
                        row("Чистая прибыль", m.netProfit.map { "\(format($0)) ₽" } ?? "—")
                    }
                    Section("Себестоимость / ставка") {
                        Text("Фикс = ГСМ + аренда + доплата. Безубыток и рекомендация учитывают % ЗП и подушку 10%.")
                            .font(.system(.caption2, design: .rounded))
                            .foregroundStyle(AppTheme.textMuted)
                        row("Себестоимость (фикс)", "\(format(m.fixedCosts)) ₽")
                        row("Полная себестоимость", m.totalCost.map { "\(format($0)) ₽" } ?? "—")
                        row("Безубыток", m.breakEvenRate.map { "\(format($0)) ₽" } ?? "—")
                        row(
                            "Рекомендация +\(Int(m.markupPercent.rounded()))%",
                            m.recommendedRate.map { "\(format($0)) ₽" } ?? "—"
                        )
                    }
                    if saved {
                        Text("Сохранено").foregroundStyle(.green).font(.caption)
                    }
                    Button("Сохранить") { save(order) }
                        .foregroundStyle(AppTheme.accent)
                }
                .scrollContentBackground(.hidden)
                .background(AppTheme.canvasTop)
                .navigationTitle("Заявка №\(order.sequentialNumber)")
                .onAppear { load(order) }
            } else {
                Text("Заявка не найдена").foregroundStyle(AppTheme.textMuted)
            }
        }
    }

    private func load(_ order: OrderRecord) {
        syncingRates = true
        customer = order.customer
        routePoints = OrderRecord.normalizedRoutePoints(
            order.routePoints,
            loading: order.loadingAddress,
            unloading: order.unloadingAddress
        )
        routeError = nil
        paymentForm = order.paymentForm ?? .cash
        ratePerKmCash = order.ratePerKmCash.map(format) ?? ""
        estimateKm = order.estimateKm.map(String.init) ?? ""
        ratePerHourWork = order.ratePerHourWork.map(format) ?? ""
        estimateWorkHours = order.estimateWorkHours.map(format) ?? ""
        workHours = order.workHours.map(format) ?? ""
        rateWithVat = order.rateWithVat.map(format) ?? ""
        rateWithoutVat = order.rateWithoutVat.map(format) ?? ""
        rateCash = order.rateCash.map(format) ?? ""
        salaryBonus = order.salaryBonus.map(format) ?? ""
        vehicleRent = order.vehicleRent.map(format) ?? ""
        emptyKmAfter = order.emptyKmAfter.map(String.init) ?? ""
        syncingRates = false
        syncFromTariff()
    }

    private func parsedDouble(_ text: String) -> Double? {
        let raw = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard let value = Double(raw), value > 0 else { return nil }
        return value
    }

    private func parsedPerKm() -> Double? { parsedDouble(ratePerKmCash) }
    private func parsedPerHour() -> Double? { parsedDouble(ratePerHourWork) }
    private func parsedEstimateHours() -> Double? { parsedDouble(estimateWorkHours) }
    private func parsedWorkHours() -> Double? { parsedDouble(workHours) }

    private func parsedEstimateKm() -> Int? {
        let digits = estimateKm.filter(\.isNumber)
        guard let value = Int(digits), value > 0 else { return nil }
        return value
    }

    private func draftOrderForTariff(_ order: OrderRecord) -> OrderRecord {
        var draft = order
        draft.ratePerKmCash = parsedPerKm()
        draft.estimateKm = parsedEstimateKm()
        draft.ratePerHourWork = parsedPerHour()
        draft.estimateWorkHours = parsedEstimateHours()
        draft.workHours = parsedWorkHours()
        draft.emptyKmAfter = Int(emptyKmAfter.filter(\.isNumber)) ?? order.emptyKmAfter
        return draft
    }

    private func chainKmLabel(for order: OrderRecord) -> String {
        let draft = draftOrderForTariff(order)
        if let total = OrderFinance.totalOrderKm(for: draft) {
            let empty = OrderFinance.emptyKm(for: draft)
            let loaded = draft.loadedKm ?? 0
            return "\(total) км (нулевой \(empty) + груз \(loaded))"
        }
        return "— (ориентир или факт после закрытия)"
    }

    private func tariffPreviewTotals(for order: OrderRecord) -> (withVat: Double, withoutVat: Double, cash: Double)? {
        let draft = draftOrderForTariff(order)
        guard let breakdown = OrderFinance.calculateClientTariff(for: draft, settings: store.financeSettings) else {
            return nil
        }
        return OrderFinance.fillRates(from: .cash, amount: breakdown.totalCash)
    }

    private func syncFromTariff() {
        guard !syncingRates else { return }
        guard let order else { return }
        let draft = draftOrderForTariff(order)
        guard let breakdown = OrderFinance.calculateClientTariff(for: draft, settings: store.financeSettings) else {
            tariffSummary = ""
            return
        }
        tariffSummary = breakdown.summaryText
        let triad = OrderFinance.fillRates(from: .cash, amount: breakdown.totalCash)
        syncingRates = true
        paymentForm = .cash
        rateCash = format(triad.cash)
        rateWithoutVat = format(triad.withoutVat)
        rateWithVat = format(triad.withVat)
        syncingRates = false
    }

    private func addressSuggestions(for kind: RoutePointKind) -> [String] {
        guard let profile = store.customer(for: customer) else { return [] }
        switch kind {
        case .loading: return profile.loadingAddresses
        case .unloading: return profile.unloadingAddresses
        }
    }

    private func addPoint(kind: RoutePointKind) {
        let insertAt = max(1, routePoints.count - 1)
        routePoints.insert(RoutePoint(address: "", kind: kind), at: insertAt)
    }

    private func movePoint(from index: Int, by delta: Int) {
        let target = index + delta
        guard routePoints.indices.contains(index), routePoints.indices.contains(target) else { return }
        routePoints.swapAt(index, target)
    }

    private func syncRates(from form: PaymentForm, text: String) {
        guard !syncingRates else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard let amount = Double(trimmed), amount > 0 else { return }
        let triad = OrderFinance.fillRates(from: form, amount: amount)
        syncingRates = true
        paymentForm = form
        // Не перезаписываем поле, которое сейчас вводит пользователь
        switch form {
        case .withVat:
            rateWithoutVat = format(triad.withoutVat)
            rateCash = format(triad.cash)
        case .withoutVat:
            rateWithVat = format(triad.withVat)
            rateCash = format(triad.cash)
        case .cash:
            rateWithVat = format(triad.withVat)
            rateWithoutVat = format(triad.withoutVat)
        }
        syncingRates = false
    }

    private func save(_ original: OrderRecord) {
        let cleaned = routePoints.compactMap { point -> RoutePoint? in
            let addr = point.address.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !addr.isEmpty else { return nil }
            return RoutePoint(id: point.id, address: addr, kind: point.kind)
        }
        guard cleaned.count >= 2 else {
            routeError = "Нужны минимум 2 точки маршрута с адресом"
            return
        }
        if !cleaned.contains(where: { $0.kind == .loading }) {
            routeError = "Добавьте хотя бы одну точку «Загрузка»"
            return
        }
        if !cleaned.contains(where: { $0.kind == .unloading }) {
            routeError = "Добавьте хотя бы одну точку «Выгрузка»"
            return
        }
        routeError = nil
        var order = original
        order.customer = customer.trimmingCharacters(in: .whitespacesAndNewlines)
        order.applyRoutePoints(cleaned)
        order.ratePerKmCash = parsedPerKm()
        order.estimateKm = parsedEstimateKm()
        order.ratePerHourWork = parsedPerHour()
        order.estimateWorkHours = parsedEstimateHours()
        order.workHours = parsedWorkHours()
        order.emptyKmAfter = Int(emptyKmAfter.filter(\.isNumber))
        order.paymentForm = paymentForm
        OrderFinance.applyClientTariff(to: &order, settings: store.financeSettings)
        if OrderFinance.calculateClientTariff(for: order, settings: store.financeSettings) == nil {
            order.rateWithVat = Double(rateWithVat.replacingOccurrences(of: ",", with: "."))
            order.rateWithoutVat = Double(rateWithoutVat.replacingOccurrences(of: ",", with: "."))
            order.rateCash = Double(rateCash.replacingOccurrences(of: ",", with: "."))
        }
        order.salaryBonus = Double(salaryBonus.replacingOccurrences(of: ",", with: "."))
        order.vehicleRent = Double(vehicleRent.replacingOccurrences(of: ",", with: "."))
        order.freight = OrderFinance.selectedRate(order)
        store.upsertOrder(order)
        routePoints = order.routePoints
        rateWithVat = order.rateWithVat.map(format) ?? rateWithVat
        rateWithoutVat = order.rateWithoutVat.map(format) ?? rateWithoutVat
        rateCash = order.rateCash.map(format) ?? rateCash
        if let b = OrderFinance.calculateClientTariff(for: order, settings: store.financeSettings) {
            tariffSummary = b.summaryText
        }
        saved = true
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value).foregroundStyle(AppTheme.accent).multilineTextAlignment(.trailing)
        }
        .font(.system(.body, design: .rounded))
    }

    private func format(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.2f", value)
    }
}

struct AdminCatalogView: View {
    @ObservedObject var store: ShiftStore

    var body: some View {
        List {
            Section("Финансы / тариф") {
                NavigationLink {
                    FinanceSettingsEditView(store: store)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("Тариф по умолчанию")
                            Spacer()
                            Text("город ≤\(store.financeSettings.cityKmThreshold) км")
                                .foregroundStyle(AppTheme.accent)
                        }
                        Text("мин \(formatHours(store.financeSettings.minWorkHours)) ч + подача \(formatHours(store.financeSettings.podachaHours)) ч · наценка \(Int(store.financeSettings.markupPercent.rounded()))%")
                            .font(.caption)
                            .foregroundStyle(AppTheme.textMuted)
                    }
                }
                .listRowBackground(AppTheme.botBubble.opacity(0.7))
            }
            Section("Заказчики") {
                if store.customers.isEmpty {
                    Text("Появятся после сохранения заявок с заказчиком")
                        .foregroundStyle(AppTheme.textMuted)
                        .listRowBackground(AppTheme.botBubble.opacity(0.7))
                }
                ForEach(store.customers) { customer in
                    NavigationLink {
                        CustomerEditView(store: store, name: customer.name)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(customer.name)
                            Text("загрузок: \(customer.loadingAddresses.count) · выгрузок: \(customer.unloadingAddresses.count)")
                                .font(.caption)
                                .foregroundStyle(AppTheme.textMuted)
                        }
                    }
                    .listRowBackground(AppTheme.botBubble.opacity(0.7))
                }
            }
            Section("Авто (л/100 км)") {
                ForEach(store.vehicles) { vehicle in
                    NavigationLink {
                        VehicleEditView(store: store, plate: vehicle.plate)
                    } label: {
                        HStack {
                            Text(vehicle.plate)
                            Spacer()
                            Text("\(Int(vehicle.consumptionPer100Km)) л")
                                .foregroundStyle(AppTheme.accent)
                        }
                    }
                    .listRowBackground(AppTheme.botBubble.opacity(0.7))
                }
            }
            Section("Водители (% от ставки)") {
                ForEach(store.drivers) { driver in
                    NavigationLink {
                        DriverEditView(store: store, name: driver.name)
                    } label: {
                        HStack {
                            Text(driver.name)
                            Spacer()
                            Text("\(Int(driver.salaryPercent))%")
                                .foregroundStyle(AppTheme.accent)
                        }
                    }
                    .listRowBackground(AppTheme.botBubble.opacity(0.7))
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(AppTheme.canvasTop)
        .navigationTitle("Справочники")
    }

    private func formatHours(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%g", value)
    }
}

struct FinanceSettingsEditView: View {
    @ObservedObject var store: ShiftStore
    @State private var markup = ""
    @State private var cityKm = ""
    @State private var minWork = ""
    @State private var podacha = ""
    @State private var perHour = ""
    @State private var perKm = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Text("Город ≤ N км: минимум часов работы + час(ы) подачи. Если нулевой × ₽/км больше подачи — к сумме добавляется ₽/км нулевого.")
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(AppTheme.textMuted)
            TextField("Наценка к себестоимости, %", text: $markup).keyboardType(.decimalPad)
            TextField("Порог города, км", text: $cityKm).keyboardType(.numberPad)
            TextField("Мин. часов работы (город)", text: $minWork).keyboardType(.decimalPad)
            TextField("Часов подачи", text: $podacha).keyboardType(.decimalPad)
            TextField("₽/час работы по умолчанию", text: $perHour).keyboardType(.decimalPad)
            TextField("₽/км нал по умолчанию", text: $perKm).keyboardType(.decimalPad)
            Button("Сохранить") {
                let m = Double(markup.replacingOccurrences(of: ",", with: ".")) ?? 15
                let threshold = Int(cityKm.filter(\.isNumber)) ?? 100
                let minH = Double(minWork.replacingOccurrences(of: ",", with: ".")) ?? 4
                let pod = Double(podacha.replacingOccurrences(of: ",", with: ".")) ?? 1
                let hour = Double(perHour.replacingOccurrences(of: ",", with: ".")) ?? 0
                let km = Double(perKm.replacingOccurrences(of: ",", with: ".")) ?? 0
                store.updateFinanceSettings(
                    FinanceSettings(
                        markupPercent: min(80, max(0, m)),
                        cityKmThreshold: max(1, threshold),
                        minWorkHours: max(0, minH),
                        podachaHours: max(0, pod),
                        defaultRatePerHourWork: max(0, hour),
                        defaultRatePerKmCash: max(0, km)
                    )
                )
                dismiss()
            }
            .foregroundStyle(AppTheme.accent)
        }
        .scrollContentBackground(.hidden)
        .background(AppTheme.canvasTop)
        .navigationTitle("Тариф")
        .onAppear {
            let s = store.financeSettings
            markup = String(format: "%g", s.markupPercent)
            cityKm = String(s.cityKmThreshold)
            minWork = String(format: "%g", s.minWorkHours)
            podacha = String(format: "%g", s.podachaHours)
            perHour = s.defaultRatePerHourWork > 0 ? String(format: "%g", s.defaultRatePerHourWork) : ""
            perKm = s.defaultRatePerKmCash > 0 ? String(format: "%g", s.defaultRatePerKmCash) : ""
        }
    }
}

struct CustomerEditView: View {
    @ObservedObject var store: ShiftStore
    let name: String
    @State private var newLoading = ""
    @State private var newUnloading = ""
    @Environment(\.dismiss) private var dismiss

    private var profile: CustomerProfile? { store.customer(for: name) }

    var body: some View {
        Form {
            Section("Заказчик") {
                Text(name)
            }
            Section("Адреса загрузки") {
                if let loads = profile?.loadingAddresses, !loads.isEmpty {
                    ForEach(loads, id: \.self) { addr in
                        HStack {
                            Text(addr)
                            Spacer()
                            Button("Удалить", role: .destructive) {
                                removeAddress(addr, kind: .loading)
                            }
                            .font(.caption)
                        }
                    }
                } else {
                    Text("Пока нет").foregroundStyle(AppTheme.textMuted)
                }
                TextField("Добавить загрузку", text: $newLoading, axis: .vertical)
                Button("Добавить") {
                    addAddress(newLoading, kind: .loading)
                    newLoading = ""
                }
                .foregroundStyle(AppTheme.accent)
            }
            Section("Адреса выгрузки") {
                if let unloads = profile?.unloadingAddresses, !unloads.isEmpty {
                    ForEach(unloads, id: \.self) { addr in
                        HStack {
                            Text(addr)
                            Spacer()
                            Button("Удалить", role: .destructive) {
                                removeAddress(addr, kind: .unloading)
                            }
                            .font(.caption)
                        }
                    }
                } else {
                    Text("Пока нет").foregroundStyle(AppTheme.textMuted)
                }
                TextField("Добавить выгрузку", text: $newUnloading, axis: .vertical)
                Button("Добавить") {
                    addAddress(newUnloading, kind: .unloading)
                    newUnloading = ""
                }
                .foregroundStyle(AppTheme.accent)
            }
            Button("Удалить заказчика", role: .destructive) {
                store.deleteCustomer(named: name)
                dismiss()
            }
        }
        .scrollContentBackground(.hidden)
        .background(AppTheme.canvasTop)
        .navigationTitle("Заказчик")
    }

    private func addAddress(_ raw: String, kind: RoutePointKind) {
        var profile = store.customer(for: name) ?? CustomerProfile(name: name)
        switch kind {
        case .loading: profile.remember(loading: raw, unloading: nil)
        case .unloading: profile.remember(loading: nil, unloading: raw)
        }
        store.updateCustomer(profile)
    }

    private func removeAddress(_ addr: String, kind: RoutePointKind) {
        guard var profile = store.customer(for: name) else { return }
        switch kind {
        case .loading:
            profile.loadingAddresses.removeAll { $0 == addr }
        case .unloading:
            profile.unloadingAddresses.removeAll { $0 == addr }
        }
        store.updateCustomer(profile)
    }
}

struct VehicleEditView: View {
    @ObservedObject var store: ShiftStore
    let plate: String
    @State private var value = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Text(plate)
            TextField("Расход л/100 км", text: $value)
                .keyboardType(.decimalPad)
            Button("Сохранить") {
                let v = Double(value.replacingOccurrences(of: ",", with: ".")) ?? 20
                store.updateVehicle(VehicleProfile(plate: plate, consumptionPer100Km: v))
                dismiss()
            }
            .foregroundStyle(AppTheme.accent)
        }
        .scrollContentBackground(.hidden)
        .background(AppTheme.canvasTop)
        .navigationTitle("Авто")
        .onAppear {
            value = String(format: "%g", store.vehicle(for: plate).consumptionPer100Km)
        }
    }
}

struct DriverEditView: View {
    @ObservedObject var store: ShiftStore
    let name: String
    @State private var value = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            Text(name)
            TextField("% от ставки", text: $value)
                .keyboardType(.decimalPad)
            Button("Сохранить") {
                let v = Double(value.replacingOccurrences(of: ",", with: ".")) ?? 30
                store.updateDriver(DriverProfile(name: name, salaryPercent: v))
                dismiss()
            }
            .foregroundStyle(AppTheme.accent)
        }
        .scrollContentBackground(.hidden)
        .background(AppTheme.canvasTop)
        .navigationTitle("Водитель")
        .onAppear {
            value = String(format: "%g", store.driver(for: name).salaryPercent)
        }
    }
}
