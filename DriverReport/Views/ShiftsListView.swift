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

struct OrdersListView: View {
    @ObservedObject var store: ShiftStore
    var adminMode: Bool = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [AppTheme.canvasTop, AppTheme.canvasBottom],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            if store.allOrders().isEmpty {
                Text("Пока нет заявок")
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(AppTheme.textMuted)
            } else {
                List {
                    ForEach(store.allOrders()) { order in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("№\(order.sequentialNumber) · за день \(order.dayNumber)")
                                .font(.system(.headline, design: .rounded))
                            Text(Self.dateTime.string(from: order.createdAt))
                                .font(.system(.caption, design: .rounded))
                                .foregroundStyle(.secondary)
                            Text(order.routeText)
                                .font(.system(.subheadline, design: .rounded))
                            Text(order.vehiclePlate)
                                .font(.system(.caption, design: .rounded))
                                .foregroundStyle(AppTheme.accent)
                            if adminMode {
                                Text("Нулевой \(order.emptyKmBefore.map(String.init) ?? "—") км · с грузом \(order.loadedKm.map(String.init) ?? "—")")
                                    .font(.system(.caption2, design: .rounded))
                                    .foregroundStyle(AppTheme.textMuted)
                            }
                            Text(order.statusText)
                                .font(.system(.caption, design: .rounded))
                                .foregroundStyle(order.isClosed ? .green : (order.isInProgress ? .orange : AppTheme.accent))
                        }
                        .listRowBackground(AppTheme.botBubble.opacity(0.55))
                    }
                }
                .scrollContentBackground(.hidden)
            }
        }
        .navigationTitle("Заявки")
        .navigationBarTitleDisplayMode(.inline)
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
