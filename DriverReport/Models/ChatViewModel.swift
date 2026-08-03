import Foundation
import SwiftUI

@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var inputMode: InputMode = .openShift
    @Published private(set) var step: ETOStep = .idle
    @Published private(set) var orderStep: OrderFlowStep = .idle
    @Published var draftNumber: String = ""
    @Published var draftText: String = ""
    @Published var lightDraft = LightChecklistAnswers()
    @Published var numberError: String?

    private(set) var activeShift: ShiftRecord?
    private var draftOrderPlate: String?
    private var draftOrderOdometer: Int?
    private var draftDayNumber: Int?
    private var draftLoadingAddress: String?
    private var draftCloseOdometer: Int?
    private var draftFuelPrice: Double?
    private var draftCloseLiters: Double?
    private var draftCloseRefueled: Bool?
    private var draftAssignedOrderId: UUID?

    private let store: ShiftStore

    init(store: ShiftStore) {
        self.store = store
        bootstrap()
    }

    private func bootstrap() {
        clearOrderDraft()
        draftNumber = ""
        draftText = ""
        numberError = nil
        lightDraft = LightChecklistAnswers()
        orderStep = .idle

        if let open = store.openShift() {
            resume(open)
            return
        }

        messages = [
            ChatMessage(
                author: .bot,
                text: "Здравствуйте! Чтобы начать работу, откройте смену. Затем пройдём ежедневный технический осмотр (ЕТО)."
            )
        ]
        activeShift = nil
        inputMode = .openShift
        step = .idle
    }

    private func carryOverHint() -> String {
        guard let open = store.inProgressOrder(), open.isCarryOverLoaded else { return "" }
        return " Есть перенесённый заказ №\(open.sequentialNumber) (машина загружена) — закроете после выгрузки."
    }

    private func resume(_ shift: ShiftRecord) {
        var shift = shift
        let stale = shift.invalidateStaleETOIfNeeded()
        if stale {
            store.upsert(shift)
        }
        activeShift = shift
        messages = shift.messages
        if messages.isEmpty {
            messages = [
                ChatMessage(
                    author: .bot,
                    text: "Продолжаем открытую смену от \(Self.dateTimeFormatter.string(from: shift.startedAt))."
                )
            ]
        }

        if shift.isETOComplete {
            step = .done
            inputMode = .afterETO
            let noted = messages.contains {
                $0.text.contains("Смена уже открыта")
                    || $0.text.contains("Продолжаем открытую смену")
                    || $0.text.contains("ЕТО на сегодня пройден")
            }
            if !noted {
                append(
                    .bot,
                    """
                    Смена уже открыта (\(shift.vehiclePlate ?? "авто")). \
                    ЕТО на сегодня пройден — можно работать с заказами или закрыть смену.\
                    \(carryOverHint())
                    """
                )
                persistMessages()
            }
            return
        }

        // Дозаполнить ЕТО с места остановки (без лишних сообщений, если история уже есть)
        let hint: String
        if shift.vehiclePlate == nil {
            step = .chooseVehicle
            inputMode = .chooseVehicle(FleetCatalog.plates)
            hint = stale
                ? "Новый день — нужно пройти ЕТО заново (за ночь с машиной могло что-то измениться). Выберите автомобиль.\(carryOverHint())"
                : "Смена открыта, но ЕТО не завершён. Выберите автомобиль.\(carryOverHint())"
        } else if shift.odometer == nil {
            step = .odometer
            inputMode = .number(placeholder: "Например, 125430")
            hint = stale
                ? "Новый день — пройдите ЕТО заново. Укажите одометр на стоянке перед выездом.\(carryOverHint())"
                : "Продолжим ЕТО. Укажите одометр до выезда со стоянки.\(carryOverHint())"
        } else if shift.fuelLiters == nil {
            step = .fuel
            inputMode = .number(placeholder: "Например, 42")
            hint = "Продолжим ЕТО. Введите остаток топлива в литрах.\(carryOverHint())"
        } else if shift.powerSteeringLevel == nil {
            step = .powerSteering
            inputMode = .fluidLevel(title: "Уровень жидкости ГУР")
            hint = "Продолжим ЕТО. Укажите уровень жидкости ГУР."
        } else if shift.coolantLevel == nil {
            step = .coolant
            inputMode = .fluidLevel(title: "Уровень ОЖ")
            hint = "Продолжим ЕТО. Укажите уровень ОЖ."
        } else if !shift.lights.isComplete {
            step = .lights
            lightDraft = shift.lights
            inputMode = .lightChecklist
            hint = "Продолжим ЕТО. Отметьте осветительные приборы."
        } else {
            step = .engineOil
            inputMode = .fluidLevel(title: "Уровень масла в ДВС")
            hint = "Продолжим ЕТО. Укажите уровень масла в ДВС."
        }
        if messages.last?.text != hint {
            append(.bot, hint)
            persistMessages()
        }
    }

    func openShift() {
        if let open = store.openShift() {
            resume(open)
            return
        }
        guard step == .idle else { return }

        let now = Date()
        var shift = ShiftRecord(startedAt: now)
        let timeText = Self.timeFormatter.string(from: now)

        append(.driver, "Открыть смену")
        let carry = carryOverHint()
        append(
            .bot,
            "Смена открыта в \(timeText). Выберите автомобиль, на котором вы сегодня работаете.\(carry.isEmpty ? "" : "\n\(carry.trimmingCharacters(in: .whitespaces))")"
        )

        shift.messages = messages
        activeShift = shift
        store.upsert(shift)

        step = .chooseVehicle
        orderStep = .idle
        inputMode = .chooseVehicle(FleetCatalog.plates)
        draftNumber = ""
        numberError = nil
    }

    func selectVehicle(_ plate: String) {
        if orderStep == .chooseVehicle {
            selectOrderVehicle(plate)
            return
        }

        guard step == .chooseVehicle, var shift = activeShift else { return }

        append(.driver, plate)
        append(.bot, "Вы выбрали автомобиль с госномером \(plate).\nНапишите показания одометра до выезда со стоянки.")

        shift.vehiclePlate = plate
        shift.messages = messages
        activeShift = shift
        store.upsert(shift)

        step = .odometer
        inputMode = .number(placeholder: "Например, 125430")
        draftNumber = ""
        numberError = nil
    }

    func submitNumber() {
        let trimmed = draftNumber.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")

        if orderStep == .arrivalOdometer {
            let digits = trimmed.filter(\.isNumber)
            guard let value = Int(digits), !digits.isEmpty else {
                numberError = "Введите целое число километров"
                return
            }
            acceptOrderArrivalOdometer(value)
            return
        }

        if orderStep == .closingOdometer {
            let digits = trimmed.filter(\.isNumber)
            guard let value = Int(digits), !digits.isEmpty else {
                numberError = "Введите целое число километров"
                return
            }
            acceptCloseOdometer(value)
            return
        }

        if orderStep == .startAssignedOdometer {
            let digits = trimmed.filter(\.isNumber)
            guard let value = Int(digits), !digits.isEmpty else {
                numberError = "Введите целое число километров"
                return
            }
            acceptStartAssignedOdometer(value)
            return
        }

        if orderStep == .fuelPrice {
            guard let price = Double(trimmed), price > 0 else {
                numberError = "Введите стоимость литра, например 56.5"
                return
            }
            draftFuelPrice = price
            append(.driver, "\(formatDecimal(price)) ₽/л")
            append(.bot, "Укажите количество литров.")
            orderStep = .fuelAmount
            inputMode = .number(placeholder: "Например, 40")
            draftNumber = ""
            numberError = nil
            persistMessages()
            return
        }

        if orderStep == .closeShiftParking {
            let digits = trimmed.filter(\.isNumber)
            guard let value = Int(digits), !digits.isEmpty else {
                numberError = "Введите целое число километров"
                return
            }
            acceptCloseShiftParking(value)
            return
        }

        if orderStep == .fuelAmount {
            guard let liters = Double(trimmed), liters > 0 else {
                numberError = "Введите количество литров, например 40"
                return
            }
            append(.driver, "\(formatDecimal(liters)) л")
            askClosingEmptyAfter(refueled: true, price: draftFuelPrice, liters: liters)
            return
        }

        if orderStep == .closingEmptyAfter {
            let digits = trimmed.filter(\.isNumber)
            guard let value = Int(digits), !digits.isEmpty else {
                numberError = "Введите целое число километров"
                return
            }
            acceptClosingEmptyAfter(value)
            return
        }

        switch step {
        case .odometer:
            let digits = trimmed.filter(\.isNumber)
            guard let odometer = Int(digits), !digits.isEmpty else {
                numberError = "Введите целое число километров"
                return
            }
            acceptOdometer(odometer)

        case .fuel:
            guard let fuel = Double(trimmed), fuel >= 0 else {
                numberError = "Введите остаток топлива в литрах, например 42"
                return
            }
            acceptFuel(fuel)

        default:
            break
        }
    }

    func submitText() {
        let text = draftText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            numberError = "Введите адрес"
            return
        }

        switch orderStep {
        case .loadingAddress:
            draftLoadingAddress = text
            append(.driver, text)
            append(.bot, "Укажите адрес выгрузки в виде: Город, адрес, номер дома, строение.")
            orderStep = .unloadingAddress
            inputMode = .text(placeholder: "Город, улица, дом, строение")
            draftText = ""
            numberError = nil
            persistMessages()

        case .unloadingAddress:
            finishOrder(unloadingAddress: text)

        default:
            break
        }
    }

    private func acceptOdometer(_ value: Int) {
        guard var shift = activeShift else { return }

        append(.driver, "\(value)")
        append(.bot, "Введите остаток топлива в литрах.")

        shift.odometer = value
        shift.lastOdometerPoint = value
        shift.messages = messages
        activeShift = shift
        store.upsert(shift)

        step = .fuel
        inputMode = .number(placeholder: "Например, 42")
        draftNumber = ""
        numberError = nil
    }

    private func acceptFuel(_ value: Double) {
        guard var shift = activeShift else { return }

        let text = value.rounded() == value ? String(Int(value)) : String(value)
        append(.driver, "\(text) л")
        append(
            .bot,
            """
            Проверьте и укажите уровень жидкости ГУР:
            • Максимум — надпись MAX на бачке ГУР
            • Середина — между MAX и MIN на бачке ГУР
            • Минимум — надпись MIN на бачке ГУР
            """
        )

        shift.fuelLiters = value
        shift.messages = messages
        activeShift = shift
        store.upsert(shift)

        step = .powerSteering
        inputMode = .fluidLevel(title: "Уровень жидкости ГУР")
        draftNumber = ""
        numberError = nil
    }

    func selectFluid(_ level: FluidLevel) {
        guard var shift = activeShift else { return }

        switch step {
        case .powerSteering:
            append(.driver, "ГУР: \(level.rawValue)")
            append(
                .bot,
                """
                Проверьте и укажите уровень охлаждающей жидкости (ОЖ) в расширительном бачке:
                • Максимум — надпись MAX
                • Середина — между MAX и MIN
                • Минимум — надпись MIN
                """
            )
            shift.powerSteeringLevel = level
            step = .coolant
            inputMode = .fluidLevel(title: "Уровень ОЖ")

        case .coolant:
            append(.driver, "ОЖ: \(level.rawValue)")
            append(
                .bot,
                "Проверьте, пожалуйста: все ли осветительные приборы исправны. Отметьте каждый пункт."
            )
            shift.coolantLevel = level
            lightDraft = LightChecklistAnswers()
            step = .lights
            inputMode = .lightChecklist

        case .engineOil:
            shift.engineOilLevel = level
            shift.completedAt = Date()
            step = .done
            orderStep = .idle
            inputMode = .afterETO
            append(.driver, "Масло ДВС: \(level.rawValue)")
            append(
                .bot,
                "Спасибо за прохождение ЕТО. Счастливого пути! Создайте заказ, когда приедете на загрузку."
            )

        default:
            return
        }

        shift.messages = messages
        activeShift = shift
        store.upsert(shift)
    }

    func setLight(lowBeam: YesNo? = nil, brakeLights: YesNo? = nil, turnSignals: YesNo? = nil) {
        if let lowBeam { lightDraft.lowBeam = lowBeam }
        if let brakeLights { lightDraft.brakeLights = brakeLights }
        if let turnSignals { lightDraft.turnSignals = turnSignals }
    }

    func submitLights() {
        guard step == .lights, var shift = activeShift, lightDraft.isComplete else {
            numberError = "Отметьте все пункты: Да или Нет"
            return
        }

        let summary = [
            "Ближний свет: \(lightDraft.lowBeam!.rawValue)",
            "Стоп-сигналы: \(lightDraft.brakeLights!.rawValue)",
            "Указатели поворотов: \(lightDraft.turnSignals!.rawValue)"
        ].joined(separator: "\n")

        append(.driver, summary)
        append(
            .bot,
            """
            Укажите уровень масла в ДВС:
            • Максимум
            • Середина
            • Минимум
            """
        )

        shift.lights = lightDraft
        shift.messages = messages
        activeShift = shift
        store.upsert(shift)

        step = .engineOil
        inputMode = .fluidLevel(title: "Уровень масла в ДВС")
        numberError = nil
    }

    // MARK: - Orders (hybrid)

    var hasOpenOrder: Bool {
        store.inProgressOrder() != nil
    }

    var openOrder: OrderRecord? {
        store.inProgressOrder()
    }

    var assignedPending: [OrderRecord] {
        store.assignedPending()
    }

    func startCreateOrder() {
        if let msg = ensureShiftReadyForOrders() {
            numberError = msg
            return
        }
        guard !hasOpenOrder else {
            numberError = "Сначала закройте текущий заказ"
            return
        }
        clearOrderDraft()
        append(.driver, "Создать заказ")
        append(.bot, "Выберите автомобиль для заказа.")
        orderStep = .chooseVehicle
        inputMode = .chooseVehicle(FleetCatalog.plates)
        numberError = nil
        persistMessages()
    }

    /// Подтянуть открытую смену и выровнять step по факту ЕТО.
    @discardableResult
    private func ensureShiftReadyForOrders() -> String? {
        if activeShift == nil, let open = store.openShift() {
            resume(open)
        }
        if var open = activeShift ?? store.openShift() {
            if open.invalidateStaleETOIfNeeded() {
                activeShift = open
                store.upsert(open)
                step = open.vehiclePlate == nil ? .chooseVehicle : .odometer
                inputMode = open.vehiclePlate == nil
                    ? .chooseVehicle(FleetCatalog.plates)
                    : .number(placeholder: "Например, 125430")
                return "Сначала завершите ЕТО"
            }
        }
        // Если UI уже после ЕТО сегодня — не блокируем старт заказа.
        if step == .done {
            if var shift = activeShift ?? store.openShift() {
                guard shift.isETOComplete else {
                    return "Сначала завершите ЕТО"
                }
                if shift.completedAt.map({ Calendar.current.isDateInToday($0) }) != true {
                    shift.completedAt = Date()
                    activeShift = shift
                    store.upsert(shift)
                }
            } else {
                return "Сначала откройте смену"
            }
            return nil
        }
        guard var shift = activeShift ?? store.openShift() else {
            return "Сначала откройте смену"
        }
        if let fresh = store.openShift(), fresh.id == shift.id {
            shift = fresh
            activeShift = fresh
        }
        guard shift.isETOComplete else {
            return "Сначала завершите ЕТО"
        }
        if shift.completedAt.map({ Calendar.current.isDateInToday($0) }) != true {
            shift.completedAt = Date()
            activeShift = shift
            store.upsert(shift)
        }
        if step != .done {
            step = .done
            inputMode = .afterETO
        }
        return nil
    }

    /// Возвращает текст ошибки или nil при успехе.
    @discardableResult
    func beginAssignedOrder(_ order: OrderRecord) -> String? {
        if let msg = ensureShiftReadyForOrders() {
            numberError = msg
            return msg
        }
        guard !hasOpenOrder else {
            let msg = "Сначала закройте текущий заказ"
            numberError = msg
            return msg
        }
        guard order.isAssignedPending else {
            let msg = "Заказ недоступен для старта"
            numberError = msg
            return msg
        }
        draftAssignedOrderId = order.id
        append(.driver, "Начать заказ №\(order.sequentialNumber)")
        append(
            .bot,
            """
            Заказ №\(order.sequentialNumber) (день \(order.dayNumber))
            Авто: \(order.vehiclePlate)
            Маршрут: \(order.routeText)
            Укажите показания одометра по прибытию на загрузку.
            """
        )
        orderStep = .startAssignedOdometer
        inputMode = .number(placeholder: "Например, 277690")
        draftNumber = ""
        numberError = nil
        persistMessages()
        return nil
    }

    private func acceptStartAssignedOdometer(_ value: Int) {
        guard var shift = activeShift,
              let id = draftAssignedOrderId,
              var order = store.allOrders().first(where: { $0.id == id }),
              order.isAssignedPending
        else {
            numberError = "Заказ не найден"
            return
        }
        guard let previous = shift.lastOdometerPoint ?? shift.odometer else {
            numberError = "Нет одометра смены. Пройдите ЕТО заново."
            return
        }
        guard value >= previous else {
            numberError = "Одометр не может быть меньше предыдущего (\(previous))"
            return
        }

        order.startOdometer = value
        order.previousOdometer = previous
        order.emptyKmBefore = value - previous
        store.attachOrder(order, to: shift.id)
        append(.driver, "\(value)")
        append(.bot, Self.formatOrderCard(order))
        append(.bot, "Заказ в работе. Когда перевозка закончится — нажмите «Закрыть заказ».")
        draftAssignedOrderId = nil
        orderStep = .idle
        inputMode = .afterETO
        draftNumber = ""
        numberError = nil
        persistMessages()
        objectWillChange.send()
    }

    func startCloseOrder() {
        guard step == .done, let order = openOrder else { return }
        append(.driver, "Закрыть заказ")
        append(
            .bot,
            "Заказ №\(order.sequentialNumber) (за день \(order.dayNumber)).\nУкажите показания одометра по окончании перевозки."
        )
        orderStep = .closingOdometer
        inputMode = .number(placeholder: "Например, 277720")
        draftNumber = ""
        numberError = nil
        persistMessages()
    }

    private func selectOrderVehicle(_ plate: String) {
        draftOrderPlate = plate
        append(.driver, plate)
        append(
            .bot,
            """
            Вы выбрали автомобиль с гос.номером \(plate).
            Укажите показания одометра по прибытию на загрузку
            """
        )
        orderStep = .arrivalOdometer
        inputMode = .number(placeholder: "Например, 277690")
        draftNumber = ""
        numberError = nil
        persistMessages()
    }

    private func acceptOrderArrivalOdometer(_ value: Int) {
        guard let previous = activeShift?.lastOdometerPoint ?? activeShift?.odometer else {
            numberError = "Нет одометра смены. Пройдите ЕТО заново."
            return
        }
        guard value >= previous else {
            numberError = "Одометр не может быть меньше предыдущего (\(previous))"
            return
        }

        draftOrderOdometer = value
        append(.driver, "\(value)")
        append(.bot, "Укажите номер заказа за день.")
        orderStep = .dayNumber
        inputMode = .dayOrderNumber
        draftNumber = ""
        numberError = nil
        persistMessages()
    }

    func selectDayOrderNumber(_ number: Int) {
        guard orderStep == .dayNumber, (1...5).contains(number) else { return }
        draftDayNumber = number
        append(.driver, "Заказ за день №\(number)")
        append(.bot, "Укажите адрес загрузки в виде: Город, адрес, номер дома, строение.")
        orderStep = .loadingAddress
        inputMode = .text(placeholder: "Город, улица, дом, строение")
        draftText = ""
        numberError = nil
        persistMessages()
    }

    private func finishOrder(unloadingAddress: String) {
        guard var shift = activeShift,
              let plate = draftOrderPlate,
              let startOdo = draftOrderOdometer,
              let dayNumber = draftDayNumber,
              let loading = draftLoadingAddress,
              let previous = shift.lastOdometerPoint ?? shift.odometer
        else {
            numberError = "Не хватает данных заказа"
            return
        }

        append(.driver, unloadingAddress)

        let emptyKm = startOdo - previous
        let seq = store.nextSequentialNumber()
        let now = Date()

        let order = OrderRecord(
            sequentialNumber: seq,
            dayNumber: dayNumber,
            createdAt: now,
            source: .driver,
            vehiclePlate: plate,
            loadingAddress: loading,
            unloadingAddress: unloadingAddress,
            startOdometer: startOdo,
            previousOdometer: previous,
            emptyKmBefore: emptyKm,
            driverPercent: store.driver(for: AppDefaults.driverName).salaryPercent
        )

        store.attachOrder(order, to: shift.id)
        shift.messages = messages
        activeShift = shift
        store.upsert(shift)

        let card = Self.formatOrderCard(order)
        append(.bot, card)
        append(.bot, "Когда перевозка закончится — нажмите «Закрыть заказ».")

        clearOrderDraft()
        orderStep = .idle
        inputMode = .afterETO
        draftText = ""
        numberError = nil
        persistMessages()
        objectWillChange.send()
    }

    private func acceptCloseOdometer(_ value: Int) {
        guard let order = openOrder, let start = order.startOdometer else {
            numberError = "Нет открытого заказа"
            return
        }
        guard value >= start else {
            numberError = "Одометр не может быть меньше начала заказа (\(start))"
            return
        }

        draftCloseOdometer = value
        append(.driver, "\(value)")
        append(.bot, "Заправляли машину?")
        orderStep = .askRefuel
        inputMode = .yesNo(prompt: "Заправляли машину?")
        draftNumber = ""
        numberError = nil
        persistMessages()
    }

    func answerYesNo(_ yes: Bool) {
        switch orderStep {
        case .askRefuel:
            answerRefuel(yes)
        case .closeShiftStaysLoaded:
            answerStaysLoadedOvernight(yes)
        default:
            break
        }
    }

    private static let defaultFuelPricePerLiter: Double = 80

    private func lastFuelPricePerLiter(plate: String?, except orderId: UUID?) -> Double? {
        let candidates = store.allOrders()
            .filter { order in
                if let orderId, order.id == orderId { return false }
                guard let price = order.fuelPricePerLiter, price > 0 else { return false }
                return true
            }
            .sorted { a, b in
                let aSame = (plate != nil && a.vehiclePlate == plate) ? 1 : 0
                let bSame = (plate != nil && b.vehiclePlate == plate) ? 1 : 0
                if aSame != bSame { return aSame > bSame }
                let aDate = a.closedAt ?? a.createdAt
                let bDate = b.closedAt ?? b.createdAt
                return aDate > bDate
            }
        return candidates.first?.fuelPricePerLiter
    }

    private func resolveFuelPriceWithoutRefuel(plate: String?, except orderId: UUID?) -> Double {
        lastFuelPricePerLiter(plate: plate, except: orderId) ?? Self.defaultFuelPricePerLiter
    }

    func answerRefuel(_ yes: Bool) {
        guard orderStep == .askRefuel else { return }
        append(.driver, yes ? "Да" : "Нет")
        if yes {
            append(.bot, "Укажите стоимость литра.")
            orderStep = .fuelPrice
            inputMode = .number(placeholder: "Например, 56.5")
            draftNumber = ""
            numberError = nil
            persistMessages()
        } else {
            let order = openOrder
            let prev = lastFuelPricePerLiter(plate: order?.vehiclePlate, except: order?.id)
            let price = prev ?? Self.defaultFuelPricePerLiter
            if prev != nil {
                append(.bot, "Заправки не было — цена литра с прошлой заправки: \(formatDecimal(price)) ₽/л.")
            } else {
                append(.bot, "Заправки не было — подставлена цена по умолчанию: \(formatDecimal(price)) ₽/л.")
            }
            askClosingEmptyAfter(refueled: false, price: price, liters: nil)
        }
    }

    private func answerStaysLoadedOvernight(_ yes: Bool) {
        guard orderStep == .closeShiftStaysLoaded else { return }
        append(.driver, yes ? "Да" : "Нет")
        guard yes else {
            append(.bot, "Сначала закройте заказ — либо подтвердите, что машина осталась загружена до завтра.")
            orderStep = .idle
            inputMode = .afterETO
            numberError = "Сначала закройте текущий заказ"
            persistMessages()
            return
        }
        append(.bot, "Укажите показания одометра по возвращении на стоянку. Заказ останется открытым до выгрузки.")
        orderStep = .closeShiftParking
        inputMode = .number(placeholder: "Например, 277800")
        draftNumber = ""
        numberError = nil
        persistMessages()
    }

    private func askClosingEmptyAfter(refueled: Bool, price: Double?, liters: Double?) {
        draftCloseRefueled = refueled
        draftFuelPrice = price
        draftCloseLiters = liters
        append(
            .bot,
            """
            Укажите одометр на стоянке или у следующего заказа \
            (пробег после выгрузки: нулевой возврат).
            """
        )
        orderStep = .closingEmptyAfter
        inputMode = .number(placeholder: "Например, 277780")
        draftNumber = ""
        numberError = nil
        persistMessages()
    }

    private func acceptClosingEmptyAfter(_ value: Int) {
        guard let endOdo = draftCloseOdometer else {
            numberError = "Нет данных закрытия заказа"
            return
        }
        guard value >= endOdo else {
            numberError = "Одометр не может быть меньше окончания заказа (\(endOdo))"
            return
        }
        append(.driver, "\(value)")
        finalizeCloseOrder(
            refueled: draftCloseRefueled ?? false,
            price: draftFuelPrice,
            liters: draftCloseLiters,
            parkingOrNextOdometer: value
        )
    }

    private func finalizeCloseOrder(
        refueled: Bool,
        price: Double?,
        liters: Double?,
        parkingOrNextOdometer: Int
    ) {
        guard var shift = activeShift,
              var order = openOrder,
              let start = order.startOdometer,
              let endOdo = draftCloseOdometer
        else {
            numberError = "Нет открытого заказа"
            return
        }

        let loaded = endOdo - start
        order.endOdometer = endOdo
        order.loadedKm = loaded
        order.emptyKmAfter = max(0, parkingOrNextOdometer - endOdo)
        order.refueled = refueled
        order.staysLoadedOvernight = nil
        if refueled, let price, let liters {
            order.fuelPricePerLiter = price
            order.fuelLiters = liters
            order.fuelTotalCost = (price * liters * 100).rounded() / 100
        } else {
            // Без заправки: ₽/л с прошлой заправки, иначе 80 ₽/л (для расчёта ГСМ)
            order.fuelLiters = nil
            order.fuelPricePerLiter = (price ?? 0) > 0
                ? price
                : resolveFuelPriceWithoutRefuel(plate: order.vehiclePlate, except: order.id)
            order.fuelTotalCost = nil
        }
        order.closedAt = Date()
        shift.lastOdometerPoint = parkingOrNextOdometer
        store.attachOrder(order, to: shift.id)

        var fuelNote = ""
        if !refueled, let price = order.fuelPricePerLiter {
            fuelNote = "\nТопливо: \(formatDecimal(price)) ₽/л (без заправки)"
        }
        append(
            .bot,
            """
            Заказ №\(order.sequentialNumber) закрыт.
            Одометр окончания: \(endOdo)
            До стоянки / след. заказа: \(order.emptyKmAfter ?? 0) км\(fuelNote)
            ЗП по заказу появится в «Заявки» после расчёта администратором.
            """
        )

        shift.messages = messages
        activeShift = shift
        store.upsert(shift)

        draftCloseOdometer = nil
        draftFuelPrice = nil
        draftCloseLiters = nil
        draftCloseRefueled = nil
        orderStep = .idle
        inputMode = .afterETO
        draftNumber = ""
        numberError = nil
        objectWillChange.send()
    }

    private func formatDecimal(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%g", value)
    }

    func startCloseShift() {
        if let msg = ensureShiftReadyForOrders() {
            numberError = msg
            return
        }
        append(.driver, "Закрыть смену")
        if let open = openOrder {
            append(
                .bot,
                """
                Есть незакрытый заказ №\(open.sequentialNumber).
                Машина осталась загружена? Выгрузка на следующий день?
                """
            )
            orderStep = .closeShiftStaysLoaded
            inputMode = .yesNo(prompt: "Машина осталась загружена?")
            draftNumber = ""
            numberError = nil
            persistMessages()
            return
        }
        append(.bot, "Укажите показания одометра по возвращении на стоянку.")
        orderStep = .closeShiftParking
        inputMode = .number(placeholder: "Например, 277800")
        draftNumber = ""
        numberError = nil
        persistMessages()
    }

    private func acceptCloseShiftParking(_ value: Int) {
        guard var shift = activeShift else {
            numberError = "Нет активной смены"
            return
        }
        let prev = shift.lastOdometerPoint ?? shift.odometer
        if let prev, value < prev {
            numberError = "Одометр не может быть меньше предыдущего (\(prev))"
            return
        }

        append(.driver, "\(value)")

        if var open = store.inProgressOrder() {
            // Исключение: машина осталась загружена до завтра.
            open.markStaysLoadedOvernight()
            store.attachOrder(open, to: shift.id)
            if let refreshed = store.allOrders().first(where: { $0.id == open.id }),
               let idx = shift.orders.firstIndex(where: { $0.id == refreshed.id }) {
                shift.orders[idx] = refreshed
            } else if !shift.orders.contains(where: { $0.id == open.id }) {
                shift.orders.append(open)
            }
            let nights = open.overnightNights ?? 1
            append(
                .bot,
                """
                Смена закрыта. Заказ №\(open.sequentialNumber) перенесён — машина загружена (ночей: \(nights)).
                Завтра после ЕТО закройте заказ после выгрузки. Админ укажет ставку хранения клиенту.
                """
            )
        } else {
            // Пробег до стоянки — по последнему закрытому заказу смены (только админу).
            if let lastClosed = shift.orders
                .filter({ $0.closedAt != nil && $0.endOdometer != nil })
                .max(by: { ($0.closedAt ?? .distantPast) < ($1.closedAt ?? .distantPast) }),
               let endOdo = lastClosed.endOdometer {
                var order = lastClosed
                order.emptyKmAfter = max(0, value - endOdo)
                store.attachOrder(order, to: shift.id)
                if let refreshed = store.allOrders().first(where: { $0.id == order.id }),
                   let idx = shift.orders.firstIndex(where: { $0.id == refreshed.id }) {
                    shift.orders[idx] = refreshed
                } else if let idx = shift.orders.firstIndex(where: { $0.id == order.id }) {
                    shift.orders[idx] = order
                }
            }
            append(.bot, "Смена закрыта. Хорошего отдыха!")
        }

        shift.parkingOdometer = value
        shift.lastOdometerPoint = value
        shift.endedAt = Date()
        shift.messages = messages
        store.upsert(shift)

        orderStep = .idle
        draftNumber = ""
        numberError = nil
        startNewShift()
    }

    /// Начать новую смену можно только если текущая закрыта.
    func startNewShift() {
        if let open = store.openShift(), !open.isClosed {
            numberError = "Сначала закройте текущую смену"
            if open.isETOComplete {
                step = .done
                inputMode = .afterETO
            }
            objectWillChange.send()
            return
        }
        activeShift = nil
        draftNumber = ""
        draftText = ""
        numberError = nil
        lightDraft = LightChecklistAnswers()
        clearOrderDraft()
        step = .idle
        orderStep = .idle
        bootstrap()
    }

    var canStartNewShift: Bool {
        store.openShift() == nil
    }

    private func clearOrderDraft() {
        draftOrderPlate = nil
        draftOrderOdometer = nil
        draftDayNumber = nil
        draftLoadingAddress = nil
        draftCloseOdometer = nil
        draftFuelPrice = nil
        draftCloseLiters = nil
        draftCloseRefueled = nil
        draftAssignedOrderId = nil
    }

    private func persistMessages() {
        guard var shift = activeShift else { return }
        shift.messages = messages
        activeShift = shift
        store.upsert(shift)
    }

    private func append(_ author: ChatAuthor, _ text: String) {
        messages.append(ChatMessage(author: author, text: text))
    }

    private static func formatOrderCard(_ order: OrderRecord) -> String {
        let date = dateTimeFormatter.string(from: order.createdAt)
        return """
        Заявка оформлена🔔

        Информация о заявке❗
        🔵Номер заказа за день - \(order.dayNumber)
        🔵Порядковый номер - \(order.sequentialNumber)
        🔵Дата - \(date)
        🔵Водитель - \(order.driverName)
        🔵Автомобиль - \(order.vehiclePlate)
        🔵Маршрут - \(order.routeText)
        🔵Одометр на начало заказа - \(order.startOdometer.map(String.init) ?? "—")
        🔵Источник - \(order.source == .dispatcher ? "диспетчер" : "водитель")
        """
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "HH:mm"
        return f
    }()

    private static let dateTimeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ru_RU")
        f.dateFormat = "dd.MM.yyyy HH:mm"
        return f
    }()
}
