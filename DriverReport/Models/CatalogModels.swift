import Foundation

enum PaymentForm: String, Codable, CaseIterable, Identifiable {
    case withVat = "С НДС"
    case withoutVat = "Без НДС"
    case cash = "Наличные"

    var id: String { rawValue }
}

struct VehicleProfile: Identifiable, Codable, Equatable {
    var id: String { plate }
    var plate: String
    /// л / 100 км
    var consumptionPer100Km: Double

    static let defaults: [VehicleProfile] = [
        VehicleProfile(plate: "О 535 МВ 198", consumptionPer100Km: 20),
        VehicleProfile(plate: "М 277 НО 198", consumptionPer100Km: 20)
    ]
}

struct DriverProfile: Identifiable, Codable, Equatable {
    var id: String { name }
    var name: String
    /// % от ставки
    var salaryPercent: Double

    static let defaults: [DriverProfile] = [
        DriverProfile(name: "Наволоцкий Е.Н.", salaryPercent: 30)
    ]
}

struct FinanceSettings: Codable, Equatable {
    /// Целевая чистая маржа от ставки, %
    var markupPercent: Double
    /// Порог «город», км на заказ (нулевой + груз + до стоянки)
    var cityKmThreshold: Int
    /// Мин. часов работы в городе
    var minWorkHours: Double
    /// Часов подачи (нулевой / возврат)
    var podachaHours: Double
    /// ₽/час работы по умолчанию
    var defaultRatePerHourWork: Double
    /// ₽/км нал по умолчанию
    var defaultRatePerKmCash: Double

    static let `default` = FinanceSettings(
        markupPercent: 15,
        cityKmThreshold: 100,
        minWorkHours: 4,
        podachaHours: 1,
        defaultRatePerHourWork: 0,
        defaultRatePerKmCash: 0
    )

    enum CodingKeys: String, CodingKey {
        case markupPercent, cityKmThreshold, minWorkHours, podachaHours
        case defaultRatePerHourWork, defaultRatePerKmCash
    }

    init(
        markupPercent: Double,
        cityKmThreshold: Int = 100,
        minWorkHours: Double = 4,
        podachaHours: Double = 1,
        defaultRatePerHourWork: Double = 0,
        defaultRatePerKmCash: Double = 0
    ) {
        self.markupPercent = markupPercent
        self.cityKmThreshold = cityKmThreshold
        self.minWorkHours = minWorkHours
        self.podachaHours = podachaHours
        self.defaultRatePerHourWork = defaultRatePerHourWork
        self.defaultRatePerKmCash = defaultRatePerKmCash
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        markupPercent = try c.decodeIfPresent(Double.self, forKey: .markupPercent) ?? 15
        cityKmThreshold = try c.decodeIfPresent(Int.self, forKey: .cityKmThreshold) ?? 100
        minWorkHours = try c.decodeIfPresent(Double.self, forKey: .minWorkHours) ?? 4
        podachaHours = try c.decodeIfPresent(Double.self, forKey: .podachaHours) ?? 1
        defaultRatePerHourWork = try c.decodeIfPresent(Double.self, forKey: .defaultRatePerHourWork) ?? 0
        defaultRatePerKmCash = try c.decodeIfPresent(Double.self, forKey: .defaultRatePerKmCash) ?? 0
    }
}

struct ClientTariffBreakdown: Equatable {
    var totalKm: Int
    var emptyKm: Int
    var loadedKm: Int
    var isCity: Bool
    var workHoursCharged: Double
    var workCash: Double
    var podachaHourCash: Double
    var emptyKmCash: Double
    var podachaCoveredByHour: Bool
    var loadedKmCash: Double
    var totalCash: Double
    var perKm: Double
    var perHour: Double

    var summaryText: String {
        var parts: [String] = []
        if workCash > 0 {
            parts.append(String(format: "работа %.1f ч = %.0f ₽", workHoursCharged, workCash))
        }
        if podachaHourCash > 0 {
            parts.append(String(format: "подача = %.0f ₽", podachaHourCash))
        }
        if emptyKmCash > 0 {
            parts.append(String(format: "нулевой %d км = %.0f ₽", emptyKm, emptyKmCash))
        } else if emptyKm > 0 && podachaCoveredByHour {
            parts.append("нулевой покрыт подачей")
        }
        if loadedKmCash > 0 {
            parts.append(String(format: "груз %d км = %.0f ₽", loadedKm, loadedKmCash))
        }
        let mode = isCity ? "город" : "межгород"
        return "[\(mode)] " + (parts.isEmpty ? "нет данных для расчёта" : parts.joined(separator: " + "))
    }
}

enum OrderFinance {
    static let cushionPercent: Double = 10
    /// Ставка с НДС = без НДС + 22%
    static let vatMarkup: Double = 0.22
    /// Наличные = без НДС − 8%
    static let cashDiscount: Double = 0.08

    /// По одной введённой ставке заполняет остальные две.
    static func fillRates(from form: PaymentForm, amount: Double) -> (withVat: Double, withoutVat: Double, cash: Double) {
        let without: Double
        switch form {
        case .withoutVat:
            without = amount
        case .withVat:
            without = amount / (1 + vatMarkup)
        case .cash:
            without = amount / (1 - cashDiscount)
        }
        return (
            round2(without * (1 + vatMarkup)),
            round2(without),
            round2(without * (1 - cashDiscount))
        )
    }

    /// Км для расчёта суммы: факт с грузом, иначе ориентир.
    static func billableKm(loadedKm: Int?, estimateKm: Int?) -> Int? {
        if let loaded = loadedKm, loaded > 0 { return loaded }
        if let estimate = estimateKm, estimate > 0 { return estimate }
        return nil
    }

    static func emptyKm(for order: OrderRecord) -> Int {
        (order.emptyKmBefore ?? 0) + (order.emptyKmAfter ?? 0)
    }

    /// Полная цепочка: стоянка → заказ → выгрузка → стоянка; иначе ориентир.
    static func totalOrderKm(for order: OrderRecord) -> Int? {
        let hasSegments = order.emptyKmBefore != nil || order.loadedKm != nil || order.emptyKmAfter != nil
        if hasSegments {
            return (order.emptyKmBefore ?? 0) + (order.loadedKm ?? 0) + (order.emptyKmAfter ?? 0)
        }
        if let estimate = order.estimateKm, estimate > 0 { return estimate }
        return nil
    }

    static func resolvedPerKm(order: OrderRecord, settings: FinanceSettings) -> Double {
        if let v = order.ratePerKmCash, v > 0 { return v }
        return max(0, settings.defaultRatePerKmCash)
    }

    static func resolvedPerHour(order: OrderRecord, settings: FinanceSettings) -> Double {
        if let v = order.ratePerHourWork, v > 0 { return v }
        return max(0, settings.defaultRatePerHourWork)
    }

    /// Комбинированный тариф: часы (мин. город) + подача + ₽/км по правилу покрытия.
    static func calculateClientTariff(
        for order: OrderRecord,
        settings: FinanceSettings
    ) -> ClientTariffBreakdown? {
        let perKm = resolvedPerKm(order: order, settings: settings)
        let perHour = resolvedPerHour(order: order, settings: settings)
        guard perKm > 0 || perHour > 0 else { return nil }

        let hasSegments = order.emptyKmBefore != nil || order.loadedKm != nil || order.emptyKmAfter != nil
        let empty = emptyKm(for: order)
        let loaded = order.loadedKm ?? 0
        let totalKm = totalOrderKm(for: order) ?? 0
        let threshold = max(1, settings.cityKmThreshold)
        let isCity = totalKm > 0 && totalKm <= threshold

        let workEntered = order.workHours ?? order.estimateWorkHours ?? 0
        let minWork = isCity ? max(0, settings.minWorkHours) : 0
        let workHoursCharged = max(workEntered, minWork)
        let workCash = round2(workHoursCharged * perHour)

        let podachaHours = max(0, settings.podachaHours)
        let applyPodacha = perHour > 0 && podachaHours > 0 && (isCity || empty > 0 || hasSegments)
        let podachaBase = applyPodacha ? round2(podachaHours * perHour) : 0
        let emptyCost = round2(Double(empty) * perKm)
        // Если подача не покрывает нулевой — добавляем ₽/км нулевого к часу подачи.
        let podachaCoveredByHour: Bool
        let emptyKmCash: Double
        if empty > 0 && perKm > 0 {
            if podachaBase > 0 && emptyCost <= podachaBase {
                podachaCoveredByHour = true
                emptyKmCash = 0
            } else if podachaBase > 0 {
                podachaCoveredByHour = false
                emptyKmCash = emptyCost
            } else {
                podachaCoveredByHour = false
                emptyKmCash = emptyCost
            }
        } else {
            podachaCoveredByHour = applyPodacha
            emptyKmCash = 0
        }
        let podachaHourCash = podachaBase

        // В городе работа покрывается часами; межгород — гружёный (или ориентир) × ₽/км.
        let loadedKmCash: Double
        if hasSegments {
            loadedKmCash = isCity ? 0 : round2(Double(loaded) * perKm)
        } else if let estimate = order.estimateKm, estimate > 0, !isCity {
            loadedKmCash = round2(Double(estimate) * perKm)
        } else {
            loadedKmCash = 0
        }

        let total = round2(workCash + podachaHourCash + emptyKmCash + loadedKmCash)
        guard total > 0 else { return nil }

        return ClientTariffBreakdown(
            totalKm: totalKm,
            emptyKm: empty,
            loadedKm: hasSegments ? loaded : (isCity ? 0 : (order.estimateKm ?? 0)),
            isCity: isCity,
            workHoursCharged: workHoursCharged,
            workCash: workCash,
            podachaHourCash: podachaHourCash,
            emptyKmCash: emptyKmCash,
            podachaCoveredByHour: podachaCoveredByHour,
            loadedKmCash: loadedKmCash,
            totalCash: total,
            perKm: perKm,
            perHour: perHour
        )
    }

    /// Суммы заказа из ₽/км (нал) × км; остальные формы — через триаду.
    static func amountsFromPerKmCash(perKmCash: Double, km: Int) -> (withVat: Double, withoutVat: Double, cash: Double)? {
        guard perKmCash > 0, km > 0 else { return nil }
        let cashTotal = round2(perKmCash * Double(km))
        return fillRates(from: .cash, amount: cashTotal)
    }

    /// Пересчитать ставки заказа по комбинированному тарифу (или legacy ₽/км).
    static func applyClientTariff(to order: inout OrderRecord, settings: FinanceSettings) {
        if let breakdown = calculateClientTariff(for: order, settings: settings) {
            let triad = fillRates(from: .cash, amount: breakdown.totalCash)
            order.rateCash = triad.cash
            order.rateWithoutVat = triad.withoutVat
            order.rateWithVat = triad.withVat
            if order.paymentForm == nil { order.paymentForm = .cash }
            order.freight = selectedRate(order)
            return
        }
        // fallback: только ₽/км × гружёный/ориентир
        applyPerKmCash(to: &order)
    }

    /// Если заданы ₽/км нал и км — пересчитать ставки заказа.
    static func applyPerKmCash(to order: inout OrderRecord) {
        guard let perKm = order.ratePerKmCash, perKm > 0 else { return }
        guard let km = billableKm(loadedKm: order.loadedKm, estimateKm: order.estimateKm) else { return }
        guard let triad = amountsFromPerKmCash(perKmCash: perKm, km: km) else { return }
        order.rateCash = triad.cash
        order.rateWithoutVat = triad.withoutVat
        order.rateWithVat = triad.withVat
        if order.paymentForm == nil { order.paymentForm = .cash }
        order.freight = selectedRate(order)
    }

    /// Доля ставки, уходящая в ЗП% + подушку%
    static func variableShare(driverPercent: Double) -> Double {
        driverPercent / 100.0 + cushionPercent / 100.0
    }

    /// Постоянные затраты: ГСМ + аренда + доплата к ЗП
    static func fixedCosts(fuelCost: Double, rent: Double, bonus: Double) -> Double {
        fuelCost + rent + bonus
    }

    /// Безубыточная ставка: fixed / (1 − ЗП% − подушка%)
    static func breakEvenRate(fixedCosts: Double, driverPercent: Double) -> Double? {
        let den = 1 - variableShare(driverPercent: driverPercent)
        guard den > 0.01 else { return nil }
        return round2(fixedCosts / den)
    }

    /// Рекомендуемая ставка под целевую маржу markup% от ставки
    static func recommendedRate(fixedCosts: Double, driverPercent: Double, markupPercent: Double) -> Double? {
        let den = 1 - variableShare(driverPercent: driverPercent) - markupPercent / 100.0
        guard den > 0.01 else { return nil }
        return round2(fixedCosts / den)
    }

    /// Полная себестоимость при заданной ставке
    static func totalCost(
        rate: Double,
        fuelCost: Double,
        rent: Double,
        driverPercent: Double,
        bonus: Double
    ) -> Double {
        let pay = driverPay(rate: rate, percent: driverPercent, bonus: bonus)
        let cush = cushion(rate: rate)
        return round2(fuelCost + rent + pay + cush)
    }

    /// км от стоянки до окончания заказа
    static func kmParkingToEnd(_ order: OrderRecord) -> Int? {
        if let end = order.endOdometer, let prev = order.previousOdometer {
            return max(0, end - prev)
        }
        let empty = order.emptyKmBefore ?? 0
        let loaded = order.loadedKm ?? 0
        if order.emptyKmBefore != nil || order.loadedKm != nil {
            return empty + loaded
        }
        return nil
    }

    static func fuelLiters(km: Int, consumptionPer100: Double) -> Double {
        Double(km) * consumptionPer100 / 100.0
    }

    static func selectedRate(_ order: OrderRecord) -> Double? {
        guard let form = order.paymentForm else { return order.freight }
        switch form {
        case .withVat: return order.rateWithVat
        case .withoutVat: return order.rateWithoutVat
        case .cash: return order.rateCash
        }
    }

    static func cushion(rate: Double) -> Double { rate * cushionPercent / 100.0 }

    static func driverPay(rate: Double, percent: Double, bonus: Double) -> Double {
        rate * percent / 100.0 + bonus
    }

    static func costPerKmWithoutVat(rateWithoutVat: Double?, loadedKm: Int?) -> Double? {
        guard let rate = rateWithoutVat, let km = loadedKm, km > 0 else { return nil }
        return rate / Double(km)
    }

    static func netProfit(
        rate: Double,
        driverPay: Double,
        cushion: Double,
        fuelCost: Double,
        rent: Double
    ) -> Double {
        rate - driverPay - cushion - fuelCost - rent
    }

    static func round2(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}
