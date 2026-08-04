import SwiftUI

struct ShiftsListView: View {
    @ObservedObject var store: ShiftStore

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [AppTheme.canvasTop, AppTheme.canvasBottom],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            if store.allShifts().isEmpty {
                Text("Пока нет сохранённых смен")
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(AppTheme.textMuted)
            } else {
                List {
                    ForEach(store.allShifts()) { shift in
                        NavigationLink {
                            ShiftDetailView(shift: shift)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(shift.vehiclePlate ?? "Без номера")
                                    .font(.system(.headline, design: .rounded))
                                Text(Self.dateTime.string(from: shift.startedAt))
                                    .font(.system(.caption, design: .rounded))
                                    .foregroundStyle(.secondary)
                                Text(shiftStatus(shift))
                                    .font(.system(.caption, design: .rounded))
                                    .foregroundStyle(shift.isClosed ? AppTheme.accent : (shift.isETOComplete ? .green : .orange))
                            }
                        }
                        .listRowBackground(AppTheme.botBubble.opacity(0.55))
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Смены")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func shiftStatus(_ shift: ShiftRecord) -> String {
        if shift.isClosed {
            return "Смена закрыта · заказов: \(shift.orders.count)"
        }
        if shift.isETOComplete {
            return "ЕТО завершён · заказов: \(shift.orders.count)"
        }
        return "В процессе"
    }

    private static let dateTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "dd.MM.yyyy HH:mm"
        return f
    }()
}

struct DriverCabinetView: View {
    @ObservedObject var store: ShiftStore
    var driverName: String = AppDefaults.driverName

    private var myOrders: [OrderRecord] {
        store.allOrders().filter { $0.driverName == driverName }
    }

    /// Заказы с начисленной ЗП (админ ввёл ставку).
    private var paidOrders: [OrderRecord] {
        myOrders
            .filter { effectivePay(for: $0) != nil }
            .sorted { earningsDate($0) > earningsDate($1) }
    }

    private var pendingOrders: [OrderRecord] {
        myOrders.filter { $0.isClosed && effectivePay(for: $0) == nil }
            .sorted { ($0.closedAt ?? $0.createdAt) > ($1.closedAt ?? $1.createdAt) }
    }

    private var totalEarned: Double {
        paidOrders.compactMap { effectivePay(for: $0) }.reduce(0, +)
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [AppTheme.canvasTop, AppTheme.canvasBottom],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(driverName)
                            .font(.system(.headline, design: .rounded))
                        Text("Заработано")
                            .font(.system(.caption, design: .rounded))
                            .foregroundStyle(AppTheme.textMuted)
                        Text("\(formatMoney(totalEarned)) ₽")
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                            .foregroundStyle(AppTheme.accent)
                        Text("По \(paidOrders.count) заказам с расчётом")
                            .font(.system(.caption2, design: .rounded))
                            .foregroundStyle(AppTheme.textMuted)
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(AppTheme.botBubble.opacity(0.75))

                if paidOrders.isEmpty && pendingOrders.isEmpty {
                    Section {
                        Text("Пока нет начислений. После закрытия заказа и расчёта администратором суммы появятся здесь.")
                            .font(.system(.subheadline, design: .rounded))
                            .foregroundStyle(AppTheme.textMuted)
                    }
                    .listRowBackground(AppTheme.botBubble.opacity(0.55))
                }

                if !paidOrders.isEmpty {
                    Section("Начисления") {
                        ForEach(paidOrders) { order in
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(Self.dayFormatter.string(from: earningsDate(order)))
                                        .font(.system(.caption, design: .rounded))
                                        .foregroundStyle(AppTheme.textMuted)
                                    Text("Заказ №\(order.sequentialNumber)")
                                        .font(.system(.headline, design: .rounded))
                                    Text("День №\(order.dayNumber) · \(order.vehiclePlate)")
                                        .font(.system(.caption, design: .rounded))
                                        .foregroundStyle(AppTheme.textMuted)
                                    Text(order.routeText)
                                        .font(.system(.caption, design: .rounded))
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                                Spacer(minLength: 8)
                                Text("\(formatMoney(effectivePay(for: order) ?? 0)) ₽")
                                    .font(.system(.headline, design: .rounded))
                                    .foregroundStyle(AppTheme.accent)
                                    .multilineTextAlignment(.trailing)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                    .listRowBackground(AppTheme.botBubble.opacity(0.55))
                }

                if !pendingOrders.isEmpty {
                    Section("Ожидают расчёта") {
                        ForEach(pendingOrders) { order in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(Self.dayFormatter.string(from: order.closedAt ?? order.createdAt))
                                    .font(.system(.caption, design: .rounded))
                                    .foregroundStyle(AppTheme.textMuted)
                                Text("Заказ №\(order.sequentialNumber) · день \(order.dayNumber)")
                                    .font(.system(.body, design: .rounded))
                                Text("ЗП ещё не начислена")
                                    .font(.system(.caption, design: .rounded))
                                    .foregroundStyle(AppTheme.textMuted)
                            }
                        }
                    }
                    .listRowBackground(AppTheme.botBubble.opacity(0.45))
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Личный кабинет")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func effectivePay(for order: OrderRecord) -> Double? {
        if let e = order.earnings { return e }
        return store.metrics(for: order).driverPay
    }

    private func earningsDate(_ order: OrderRecord) -> Date {
        order.closedAt ?? order.createdAt
    }

    private func formatMoney(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.2f", value)
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "dd.MM.yyyy"
        return f
    }()
}

struct OrdersListView: View {
    @ObservedObject var store: ShiftStore
    var adminMode: Bool = false
    var driverName: String = AppDefaults.driverName
    var chatViewModel: ChatViewModel?
    @Environment(\.dismiss) private var dismiss
    @State private var startError: String?

    private var orders: [OrderRecord] {
        let all = store.allOrders()
        if adminMode { return all }
        return all.filter { $0.driverName == driverName && $0.onExchange != true }
    }

    private var exchangeOrders: [OrderRecord] {
        adminMode ? [] : store.exchangeBoard(for: driverName)
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [AppTheme.canvasTop, AppTheme.canvasBottom],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            if orders.isEmpty && exchangeOrders.isEmpty {
                Text("Пока нет заявок")
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(AppTheme.textMuted)
            } else {
                List {
                    if !exchangeOrders.isEmpty {
                        Section("Биржа") {
                            ForEach(exchangeOrders) { order in
                                orderRow(order, exchange: true)
                                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                        Button("Взять заказ") { takeExchange(order) }
                                            .tint(AppTheme.accent)
                                    }
                            }
                        }
                    }
                    if !orders.isEmpty {
                        Section(adminMode ? "Все заявки" : "Мои заявки") {
                            ForEach(orders) { order in
                                orderRow(order, exchange: false)
                                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                        if !adminMode, order.isAssignedPending {
                                            Button("Начать заказ") { startAssigned(order) }
                                                .tint(AppTheme.accent)
                                        }
                                    }
                            }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Заявки")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Нельзя начать заказ", isPresented: Binding(
            get: { startError != nil },
            set: { if !$0 { startError = nil } }
        )) {
            Button("OK", role: .cancel) { startError = nil }
        } message: {
            Text(startError ?? "")
        }
    }

    @ViewBuilder
    private func orderRow(_ order: OrderRecord, exchange: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(exchange
                 ? "Биржа · №\(order.sequentialNumber) · день \(order.dayNumber)"
                 : "№\(order.sequentialNumber) · за день \(order.dayNumber)")
                .font(.system(.headline, design: .rounded))
            Text(Self.dateTime.string(from: order.createdAt))
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(.secondary)
            Text(order.routeText)
                .font(.system(.subheadline, design: .rounded))
            if !exchange {
                Text(order.vehiclePlate)
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(AppTheme.accent)
            }
            if !order.contactLine.isEmpty {
                Text(order.contactLine)
                    .font(.system(.caption, weight: .semibold, design: .rounded))
                    .foregroundStyle(AppTheme.accent)
            }
            if let phone = order.contactPhone, !phone.isEmpty,
               let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") {
                Link("Позвонить \(phone)", destination: url)
                    .font(.system(.caption, design: .rounded))
            }
            if adminMode {
                Text("Нулевой \(order.emptyKmBefore.map(String.init) ?? "—") км · с грузом \(order.loadedKm.map(String.init) ?? "—")")
                    .font(.system(.caption2, design: .rounded))
                    .foregroundStyle(AppTheme.textMuted)
                if let pay = store.metrics(for: order).driverPay {
                    Text("ЗП: \(formatMoney(pay)) ₽")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(AppTheme.accent)
                }
            } else if !exchange {
                if let pay = order.earnings ?? store.metrics(for: order).driverPay {
                    Text("ЗП: \(formatMoney(pay)) ₽")
                        .font(.system(.subheadline, weight: .semibold, design: .rounded))
                        .foregroundStyle(AppTheme.accent)
                } else if order.isClosed {
                    Text("ЗП: ожидает расчёта")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(AppTheme.textMuted)
                }
            }
            Text(exchange ? "На бирже" : order.statusText)
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(order.isClosed ? .green : (order.isInProgress ? .orange : AppTheme.accent))
        }
        .listRowBackground(AppTheme.botBubble.opacity(0.55))
    }

    private func takeExchange(_ order: OrderRecord) {
        let plate = store.openShift()?.vehiclePlate
        guard store.takeExchangeOrder(order.id, driverName: driverName, vehiclePlate: plate) != nil else {
            startError = "Заказ уже недоступен или биржа выключена"
            return
        }
        if let taken = store.orders.first(where: { $0.id == order.id }) {
            startAssigned(taken)
        }
    }

    private func startAssigned(_ order: OrderRecord) {
        guard let chatViewModel else {
            startError = "Сначала откройте смену и пройдите ЕТО"
            return
        }
        if let err = chatViewModel.beginAssignedOrder(order) {
            startError = err
        } else {
            dismiss()
        }
    }

    private func formatMoney(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.2f", value)
    }

    private static let dateTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "dd.MM.yyyy HH:mm"
        return f
    }()
}

struct ShiftDetailView: View {
    let shift: ShiftRecord

    var body: some View {
        ZStack {
            AppTheme.canvasTop.ignoresSafeArea()

            List {
                section("Смена") {
                    row("Начало", Self.dateTime.string(from: shift.startedAt))
                    row("Автомобиль", shift.vehiclePlate ?? "—")
                    row("Статус", shift.isETOComplete ? "ЕТО завершён" : "В процессе")
                }
                section("Показания") {
                    row("Одометр", shift.odometer.map(String.init) ?? "—")
                    row("Топливо, л", shift.fuelLiters.map { formatFuel($0) } ?? "—")
                }
                section("Жидкости") {
                    row("ГУР", shift.powerSteeringLevel?.rawValue ?? "—")
                    row("ОЖ", shift.coolantLevel?.rawValue ?? "—")
                    row("Масло ДВС", shift.engineOilLevel?.rawValue ?? "—")
                }
                section("Освещение") {
                    row("Ближний свет", shift.lights.lowBeam?.rawValue ?? "—")
                    row("Стоп-сигналы", shift.lights.brakeLights?.rawValue ?? "—")
                    row("Поворотники", shift.lights.turnSignals?.rawValue ?? "—")
                }
                if !shift.orders.isEmpty {
                    section("Заявки смены") {
                        ForEach(shift.orders) { order in
                            VStack(alignment: .leading, spacing: 4) {
                                Text("№\(order.sequentialNumber) (день \(order.dayNumber)) · \(order.isClosed ? "закрыт" : "открыт")")
                                Text(order.routeText)
                                    .foregroundStyle(AppTheme.accent)
                            }
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Карточка смены")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        Section(title) {
            content()
        }
        .listRowBackground(AppTheme.botBubble.opacity(0.55))
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value).foregroundStyle(AppTheme.accent)
        }
        .font(.system(.body, design: .rounded))
    }

    private func formatFuel(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(value)
    }

    private static let dateTime: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "dd.MM.yyyy HH:mm"
        return f
    }()
}
