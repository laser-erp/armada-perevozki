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
            "₽/л", "С НДС", "Без НДС", "Нал", "Доплата ЗП",
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
            }
            Section("Маршрут") {
                TextField("Адрес загрузки", text: $loading, axis: .vertical)
                TextField("Адрес выгрузки", text: $unloading, axis: .vertical)
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
    @State private var paymentForm: PaymentForm = .withVat
    @State private var rateWithVat = ""
    @State private var rateWithoutVat = ""
    @State private var rateCash = ""
    @State private var salaryBonus = ""
    @State private var vehicleRent = ""
    @State private var emptyKmAfter = ""
    @State private var saved = false

    private var order: OrderRecord? {
        store.allOrders().first { $0.id == orderId }
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
                        row("Маршрут", order.routeText)
                        TextField("Заказчик", text: $customer)
                    }
                    Section("Пробеги") {
                        row("Нулевой до заказа", "\(order.emptyKmBefore.map(String.init) ?? "—") км")
                        row("С грузом", "\(order.loadedKm.map(String.init) ?? "—") км")
                        TextField("Пробег до стоянки, км", text: $emptyKmAfter)
                            .keyboardType(.numberPad)
                        row("От стоянки до конца", "\(m.kmParkingToEnd.map(String.init) ?? "—") км")
                        row("Общий за день (по полям)", "\(order.dayTotalKm.map(String.init) ?? "—") км")
                    }
                    Section("Ставка / оплата") {
                        Picker("Форма", selection: $paymentForm) {
                            ForEach(PaymentForm.allCases) { Text($0.rawValue).tag($0) }
                        }
                        TextField("Ставка с НДС", text: $rateWithVat).keyboardType(.decimalPad)
                        TextField("Ставка без НДС", text: $rateWithoutVat).keyboardType(.decimalPad)
                        TextField("Ставка наличные", text: $rateCash).keyboardType(.decimalPad)
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
        customer = order.customer
        paymentForm = order.paymentForm ?? .withVat
        rateWithVat = order.rateWithVat.map(format) ?? ""
        rateWithoutVat = order.rateWithoutVat.map(format) ?? ""
        rateCash = order.rateCash.map(format) ?? ""
        salaryBonus = order.salaryBonus.map(format) ?? ""
        vehicleRent = order.vehicleRent.map(format) ?? ""
        emptyKmAfter = order.emptyKmAfter.map(String.init) ?? ""
    }

    private func save(_ original: OrderRecord) {
        var order = original
        order.customer = customer.trimmingCharacters(in: .whitespacesAndNewlines)
        order.paymentForm = paymentForm
        order.rateWithVat = Double(rateWithVat.replacingOccurrences(of: ",", with: "."))
        order.rateWithoutVat = Double(rateWithoutVat.replacingOccurrences(of: ",", with: "."))
        order.rateCash = Double(rateCash.replacingOccurrences(of: ",", with: "."))
        order.salaryBonus = Double(salaryBonus.replacingOccurrences(of: ",", with: "."))
        order.vehicleRent = Double(vehicleRent.replacingOccurrences(of: ",", with: "."))
        order.emptyKmAfter = Int(emptyKmAfter.filter(\.isNumber))
        // sync selected rate into freight for compatibility
        order.freight = OrderFinance.selectedRate(order)
        store.upsertOrder(order)
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
