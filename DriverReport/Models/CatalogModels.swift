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

struct ContactPhone: Identifiable, Codable, Equatable {
    var id: String
    var number: String
    var label: String

    init(id: String = UUID().uuidString, number: String, label: String = "") {
        self.id = id
        self.number = number
        self.label = label
    }
}

struct CompanyContact: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var title: String
    var phones: [ContactPhone]
    var isPrimary: Bool

    init(
        id: String = UUID().uuidString,
        name: String,
        title: String = "",
        phones: [ContactPhone] = [],
        isPrimary: Bool = false
    ) {
        self.id = id
        self.name = name
        self.title = title
        self.phones = phones
        self.isPrimary = isPrimary
    }

    var primaryPhone: String { phones.first?.number ?? "" }
}

struct CarrierVehicle: Identifiable, Codable, Equatable {
    var id: String
    var plate: String
    var makeModel: String
    var payloadTons: Double?
    var bodyLengthM: Double?
    var bodyWidthM: Double?
    var bodyHeightM: Double?

    init(
        id: String = UUID().uuidString,
        plate: String,
        makeModel: String = "",
        payloadTons: Double? = nil,
        bodyLengthM: Double? = nil,
        bodyWidthM: Double? = nil,
        bodyHeightM: Double? = nil
    ) {
        self.id = id
        self.plate = plate
        self.makeModel = makeModel
        self.payloadTons = payloadTons
        self.bodyLengthM = bodyLengthM
        self.bodyWidthM = bodyWidthM
        self.bodyHeightM = bodyHeightM
    }
}

struct CarrierDriver: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var phone: String
    var vehicleId: String?

    init(id: String = UUID().uuidString, name: String, phone: String = "", vehicleId: String? = nil) {
        self.id = id
        self.name = name
        self.phone = phone
        self.vehicleId = vehicleId
    }
}

struct DriverProfile: Identifiable, Codable, Equatable {
    var id: String { name }
    var name: String
    /// % от ставки
    var salaryPercent: Double
    var phone: String
    /// Биржу включает только администратор
    var exchangeEnabled: Bool

    init(name: String, salaryPercent: Double, phone: String = "", exchangeEnabled: Bool = false) {
        self.name = name
        self.salaryPercent = salaryPercent
        self.phone = phone
        self.exchangeEnabled = exchangeEnabled
    }

    enum CodingKeys: String, CodingKey { case name, salaryPercent, phone, exchangeEnabled }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        salaryPercent = try c.decodeIfPresent(Double.self, forKey: .salaryPercent) ?? 30
        phone = try c.decodeIfPresent(String.self, forKey: .phone) ?? ""
        exchangeEnabled = try c.decodeIfPresent(Bool.self, forKey: .exchangeEnabled) ?? false
    }

    static let defaults: [DriverProfile] = [
        DriverProfile(name: "Наволоцкий Е.Н.", salaryPercent: 30)
    ]
}

struct CustomerProfile: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    /// customer / carrier (можно обе роли)
    var roles: [String]
    var note: String
    var phones: [ContactPhone]
    var contacts: [CompanyContact]
    var loadingAddresses: [String]
    var unloadingAddresses: [String]
    var vehicles: [CarrierVehicle]
    var drivers: [CarrierDriver]

    var isCustomer: Bool { roles.contains("customer") || roles.isEmpty }
    var isCarrier: Bool { roles.contains("carrier") }

    init(
        id: String = UUID().uuidString,
        name: String,
        roles: [String] = ["customer"],
        note: String = "",
        phones: [ContactPhone] = [],
        contacts: [CompanyContact] = [],
        loadingAddresses: [String] = [],
        unloadingAddresses: [String] = [],
        vehicles: [CarrierVehicle] = [],
        drivers: [CarrierDriver] = []
    ) {
        self.id = id
        self.name = name
        self.roles = roles.isEmpty ? ["customer"] : roles
        self.note = note
        self.phones = phones
        self.contacts = contacts
        self.loadingAddresses = Self.uniqueSorted(loadingAddresses)
        self.unloadingAddresses = Self.uniqueSorted(unloadingAddresses)
        self.vehicles = vehicles
        self.drivers = drivers
    }

    enum CodingKeys: String, CodingKey {
        case id, name, roles, note, phones, contacts
        case loadingAddresses, unloadingAddresses, vehicles, drivers
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        roles = try c.decodeIfPresent([String].self, forKey: .roles) ?? ["customer"]
        if roles.isEmpty { roles = ["customer"] }
        note = try c.decodeIfPresent(String.self, forKey: .note) ?? ""
        phones = try c.decodeIfPresent([ContactPhone].self, forKey: .phones) ?? []
        contacts = try c.decodeIfPresent([CompanyContact].self, forKey: .contacts) ?? []
        loadingAddresses = Self.uniqueSorted(try c.decodeIfPresent([String].self, forKey: .loadingAddresses) ?? [])
        unloadingAddresses = Self.uniqueSorted(try c.decodeIfPresent([String].self, forKey: .unloadingAddresses) ?? [])
        vehicles = try c.decodeIfPresent([CarrierVehicle].self, forKey: .vehicles) ?? []
        drivers = try c.decodeIfPresent([CarrierDriver].self, forKey: .drivers) ?? []
    }

    mutating func remember(loading: String?, unloading: String?) {
        if let loading {
            let trimmed = loading.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, !loadingAddresses.contains(trimmed) {
                loadingAddresses.insert(trimmed, at: 0)
            }
        }
        if let unloading {
            let trimmed = unloading.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty, !unloadingAddresses.contains(trimmed) {
                unloadingAddresses.insert(trimmed, at: 0)
            }
        }
        loadingAddresses = Self.uniqueSorted(loadingAddresses)
        unloadingAddresses = Self.uniqueSorted(unloadingAddresses)
    }

    mutating func remember(routePoints: [RoutePoint]) {
        for point in routePoints {
            let addr = point.address.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !addr.isEmpty else { continue }
            switch point.kind {
            case .loading:
                if !loadingAddresses.contains(addr) { loadingAddresses.insert(addr, at: 0) }
            case .unloading:
                if !unloadingAddresses.contains(addr) { unloadingAddresses.insert(addr, at: 0) }
            }
        }
        loadingAddresses = Self.uniqueSorted(loadingAddresses)
        unloadingAddresses = Self.uniqueSorted(unloadingAddresses)
    }

    private static func uniqueSorted(_ values: [String]) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for raw in values {
            let v = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !v.isEmpty else { continue }
            let key = v.lowercased()
            if seen.insert(key).inserted {
                result.append(v)
            }
        }
        return result
    }
}

struct FinanceSettings: Codable, Equatable {
    /// Целевая чистая маржа от ставки, %
    var markupPercent: Double
    /// Км в пакете (груз + нулевой после стоянки)
    var cityKmThreshold: Int
    /// Мин. часов работы в пакете
    var minWorkHours: Double
    /// Базовые часы подачи (если нулевой до не покрыт — ×2)
    var podachaHours: Double
    /// ₽/час работы по умолчанию
    var defaultRatePerHourWork: Double
    /// ₽/км сверх пакета по умолчанию
    var defaultRatePerKmCash: Double

    static let `default` = FinanceSettings(
        markupPercent: 15,
        cityKmThreshold: 100,
        minWorkHours: 4,
        podachaHours: 1,
        defaultRatePerHourWork: 0,
        defaultRatePerKmCash: 80
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
        let km = try c.decodeIfPresent(Double.self, forKey: .defaultRatePerKmCash) ?? 80
        defaultRatePerKmCash = km > 0 ? km : 80
    }
}

struct ClientTariffBreakdown: Equatable {
    var totalKm: Int
    var emptyKmBefore: Int
    var packageKm: Int
    var excessKm: Int
    var isWithinPackage: Bool
    var workHoursCharged: Double
    var workCash: Double
    var podachaHoursCharged: Double
    var podachaHourCash: Double
    var podachaCoveredByHour: Bool
    var excessKmCash: Double
    var overnightStorageCash: Double
    var overnightNights: Int
    var overnightStorageRateCash: Double
    var totalCash: Double
    var perKm: Double
    var perHour: Double

    /// Совместимость со старым UI (город ≈ в пакете).
    var isCity: Bool { isWithinPackage }
    var emptyKm: Int { emptyKmBefore }
    var loadedKm: Int { packageKm }
    var emptyKmCash: Double { 0 }
    var loadedKmCash: Double { excessKmCash }

    var summaryText: String {
        var parts: [String] = []
        if workCash > 0 {
            parts.append(String(format: "работа %.1f ч = %.0f ₽", workHoursCharged, workCash))
        }
        if podachaHourCash > 0 {
            parts.append(String(format: "подача %.1f ч = %.0f ₽", podachaHoursCharged, podachaHourCash))
            if emptyKmBefore > 0 {
                if podachaCoveredByHour {
                    parts.append(String(format: "нулевой до %d км покрыт подачей", emptyKmBefore))
                } else {
                    parts.append(String(format: "нулевой до %d км → 2 ч подачи", emptyKmBefore))
                }
            }
        }
        if packageKm > 0 {
            if excessKmCash > 0 {
                parts.append(String(
                    format: "сверх: %d км × %.0f = %.0f ₽ (груз+после %d км)",
                    excessKm, perKm, excessKmCash, packageKm
                ))
            } else {
                parts.append(String(format: "км в пакете: %d", packageKm))
            }
        }
        if overnightStorageCash > 0 {
            parts.append(String(
                format: "хранение %d×%.0f = %.0f ₽",
                overnightNights,
                overnightStorageRateCash,
                overnightStorageCash
            ))
        }
        let mode = (perKm > 0 || perHour > 0) ? "пакет" : "хранение"
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
        let def = settings.defaultRatePerKmCash
        return def > 0 ? def : 80
    }

    static func resolvedPerHour(order: OrderRecord, settings: FinanceSettings) -> Double {
        if let v = order.ratePerHourWork, v > 0 { return v }
        return max(0, settings.defaultRatePerHourWork)
    }

    /// Км в пакете: груз + нулевой после. Нулевой до заказа — через подачу.
    static func packageKm(for order: OrderRecord) -> Int {
        if order.loadedKm != nil || order.emptyKmAfter != nil {
            return (order.loadedKm ?? 0) + (order.emptyKmAfter ?? 0)
        }
        if let estimate = order.estimateKm, estimate > 0 { return estimate }
        return 0
    }

    /// Ночное хранение: ₽/ночь × число ночей (нал).
    static func overnightStorageCash(for order: OrderRecord) -> Double {
        guard let rate = order.overnightStorageRateCash, rate > 0,
              let nights = order.overnightNights, nights > 0 else { return 0 }
        return round2(rate * Double(nights))
    }

    /// База ЗП/подушки: ставка нал минус хранение (ответственность компании).
    static func payrollRate(for order: OrderRecord) -> Double? {
        guard let rate = selectedRate(order) else { return nil }
        return round2(max(0, rate - overnightStorageCash(for: order)))
    }

    /// Пакетный тариф: мин. часы + подача (1/2 ч) + сверхкм + хранение.
    static func calculateClientTariff(
        for order: OrderRecord,
        settings: FinanceSettings
    ) -> ClientTariffBreakdown? {
        let perKm = resolvedPerKm(order: order, settings: settings)
        let perHour = resolvedPerHour(order: order, settings: settings)
        let storageCash = overnightStorageCash(for: order)
        guard perKm > 0 || perHour > 0 || storageCash > 0 else { return nil }

        let emptyBefore = order.emptyKmBefore ?? 0
        let package = packageKm(for: order)
        let totalKm = totalOrderKm(for: order) ?? 0
        let threshold = max(1, settings.cityKmThreshold)
        let minWork = max(0, settings.minWorkHours)
        let basePodacha = max(0, settings.podachaHours)

        let workEntered = order.workHours ?? order.estimateWorkHours ?? 0
        let workHoursCharged = perHour > 0 ? max(workEntered, minWork) : 0
        let workCash = round2(workHoursCharged * perHour)

        var podachaHoursCharged: Double = 0
        var podachaCoveredByHour = true
        if perHour > 0 && basePodacha > 0 {
            let oneHourCash = round2(basePodacha * perHour)
            let emptyBeforeCost = round2(Double(emptyBefore) * perKm)
            if emptyBefore > 0 && emptyBeforeCost > oneHourCash {
                podachaHoursCharged = basePodacha * 2
                podachaCoveredByHour = false
            } else {
                podachaHoursCharged = basePodacha
                podachaCoveredByHour = true
            }
        }
        let podachaHourCash = round2(podachaHoursCharged * perHour)
        let excessKm = package > threshold ? package - threshold : 0
        let excessKmCash = round2(Double(excessKm) * perKm)
        let total = round2(workCash + podachaHourCash + excessKmCash + storageCash)
        guard total > 0 else { return nil }

        return ClientTariffBreakdown(
            totalKm: totalKm,
            emptyKmBefore: emptyBefore,
            packageKm: package,
            excessKm: excessKm,
            isWithinPackage: package > 0 && package <= threshold,
            workHoursCharged: workHoursCharged,
            workCash: workCash,
            podachaHoursCharged: podachaHoursCharged,
            podachaHourCash: podachaHourCash,
            podachaCoveredByHour: podachaCoveredByHour,
            excessKmCash: excessKmCash,
            overnightStorageCash: storageCash,
            overnightNights: order.overnightNights ?? 0,
            overnightStorageRateCash: order.overnightStorageRateCash ?? 0,
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

    /// Км для списания топлива: полная цепочка, иначе стоянка→конец заказа.
    static func tripKmForFuel(_ order: OrderRecord) -> Int? {
        if let total = order.dayTotalKm { return total }
        return kmParkingToEnd(order)
    }

    /// Остаток до заказа: прошлый заказ по авто, иначе ЕТО. Не подставляем 80 л.
    static func resolveFuelRemainingBefore(
        plate: String,
        except orderId: UUID?,
        shiftFuel: Double?,
        previousOrders: [OrderRecord]
    ) -> Double? {
        let prev = previousOrders
            .filter { order in
                if let orderId, order.id == orderId { return false }
                guard order.vehiclePlate == plate else { return false }
                guard let rem = order.fuelRemainingLiters, rem >= 0 else { return false }
                return true
            }
            .sorted { a, b in
                (a.closedAt ?? a.createdAt) > (b.closedAt ?? b.createdAt)
            }
            .first?
            .fuelRemainingLiters
        if let prev { return prev }
        if let shiftFuel, shiftFuel >= 0 { return shiftFuel }
        return nil
    }

    /// Остаток после: до − расход [+ залито]. Без исходного остатка — nil.
    static func computeFuelRemainingAfter(
        before: Double?,
        tripKm: Int?,
        consumptionPer100: Double,
        refillLiters: Double?
    ) -> Double? {
        guard let before, before >= 0, let tripKm, consumptionPer100 >= 0 else { return nil }
        let used = round2(fuelLiters(km: tripKm, consumptionPer100: consumptionPer100))
        let add = (refillLiters ?? 0) > 0 ? (refillLiters ?? 0) : 0
        return round2(max(0, before - used + add))
    }

    /// Ставка для ЗП / подушки / прибыли — всегда наличные
    /// (в «с НДС» заложен НДС 22%, в «без НДС» — 8% относительно нал).
    static func selectedRate(_ order: OrderRecord) -> Double? {
        if let cash = order.rateCash { return cash }
        return order.freight
    }

    /// Ставка по форме оплаты клиента (для документов / отображения).
    static func clientRate(_ order: OrderRecord) -> Double? {
        guard let form = order.paymentForm else { return selectedRate(order) }
        switch form {
        case .withVat: return order.rateWithVat ?? selectedRate(order)
        case .withoutVat: return order.rateWithoutVat ?? selectedRate(order)
        case .cash: return order.rateCash ?? selectedRate(order)
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
