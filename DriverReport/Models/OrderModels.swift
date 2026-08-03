import Foundation

enum OrderSource: String, Codable {
    case driver
    case dispatcher
}

enum RoutePointKind: String, Codable, CaseIterable, Identifiable {
    case loading
    case unloading

    var id: String { rawValue }

    var titleRu: String {
        switch self {
        case .loading: return "Загрузка"
        case .unloading: return "Выгрузка"
        }
    }
}

struct RoutePoint: Identifiable, Codable, Equatable {
    var id: UUID
    var address: String
    var kind: RoutePointKind

    init(id: UUID = UUID(), address: String, kind: RoutePointKind) {
        self.id = id
        self.address = address
        self.kind = kind
    }

    var labeledText: String { "\(kind.titleRu): \(address)" }

    enum CodingKeys: String, CodingKey { case id, address, kind }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(UUID.self, forKey: .id) ?? UUID()
        address = try c.decode(String.self, forKey: .address)
        kind = try c.decode(RoutePointKind.self, forKey: .kind)
    }
}

struct OrderRecord: Identifiable, Codable, Equatable {
    let id: UUID
    let sequentialNumber: Int
    let dayNumber: Int
    let createdAt: Date
    var source: OrderSource
    var vehiclePlate: String
    var driverName: String
    var customer: String
    var loadingAddress: String
    var unloadingAddress: String
    /// Маршрут: точки с типом загрузка/выгрузка. Минимум 2.
    var routePoints: [RoutePoint]
    var startOdometer: Int?
    var previousOdometer: Int?
    var emptyKmBefore: Int?
    var loadedKm: Int?
    var emptyKmAfter: Int?
    var endOdometer: Int?
    var closedAt: Date?
    var refueled: Bool?
    var fuelPricePerLiter: Double?
    var fuelLiters: Double?
    var fuelTotalCost: Double?
    /// legacy / fallback
    var freight: Double?
    var paymentForm: PaymentForm?
    var rateWithVat: Double?
    var rateWithoutVat: Double?
    var rateCash: Double?
    /// Базовая ставка для клиента: ₽/км наличными; остальные формы считаются от неё.
    var ratePerKmCash: Double?
    /// Ориентировочный км, пока нет факта цепочки.
    var estimateKm: Int?
    /// ₽/час работы (переопределение справочника).
    var ratePerHourWork: Double?
    /// Ориентир часов работы.
    var estimateWorkHours: Double?
    /// Факт часов работы (админ после закрытия).
    var workHours: Double?
    var salaryBonus: Double?
    var vehicleRent: Double?
    var driverPercent: Double
    var earnings: Double?
    /// Смена закрыта при незакрытом заказе: машина осталась загружена, выгрузка на следующий день.
    var staysLoadedOvernight: Bool?
    /// ₽ за ночь хранения груза (нал, ответственность компании).
    var overnightStorageRateCash: Double?
    /// Число ночей хранения; +1 при каждом «осталась загружена».
    var overnightNights: Int?

    var routeText: String {
        let points = Self.normalizedRoutePoints(routePoints, loading: loadingAddress, unloading: unloadingAddress)
        return points.map(\.labeledText).joined(separator: " → ")
    }

    /// Гарантирует ≥2 точки и синхронизирует legacy loading/unloading.
    mutating func applyRoutePoints(_ points: [RoutePoint]) {
        let normalized = Self.normalizedRoutePoints(points, loading: loadingAddress, unloading: unloadingAddress)
        routePoints = normalized
        loadingAddress = normalized.first(where: { $0.kind == .loading })?.address ?? normalized[0].address
        unloadingAddress = normalized.last(where: { $0.kind == .unloading })?.address
            ?? normalized[normalized.count - 1].address
    }

    static func defaultRoutePoints(loading: String, unloading: String) -> [RoutePoint] {
        let load = loading.trimmingCharacters(in: .whitespacesAndNewlines)
        let unload = unloading.trimmingCharacters(in: .whitespacesAndNewlines)
        return [
            RoutePoint(address: load.isEmpty ? "Адрес загрузки" : load, kind: .loading),
            RoutePoint(address: unload.isEmpty ? "Адрес выгрузки" : unload, kind: .unloading)
        ]
    }

    static func normalizedRoutePoints(
        _ points: [RoutePoint],
        loading: String,
        unloading: String
    ) -> [RoutePoint] {
        let cleaned = points.compactMap { point -> RoutePoint? in
            let addr = point.address.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !addr.isEmpty else { return nil }
            return RoutePoint(id: point.id, address: addr, kind: point.kind)
        }
        if cleaned.count >= 2 { return cleaned }
        return defaultRoutePoints(loading: loading, unloading: unloading)
    }

    /// Миграция старого формата [String]: первая — загрузка, последняя — выгрузка, средние — загрузка.
    static func migrateStringRoutePoints(
        _ strings: [String],
        loading: String,
        unloading: String
    ) -> [RoutePoint] {
        let cleaned = strings
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard cleaned.count >= 2 else {
            return defaultRoutePoints(loading: loading, unloading: unloading)
        }
        return cleaned.enumerated().map { index, address in
            let kind: RoutePointKind = (index == cleaned.count - 1) ? .unloading : .loading
            return RoutePoint(address: address, kind: kind)
        }
    }

    var isClosed: Bool { closedAt != nil }
    var isAssignedPending: Bool { !isClosed && startOdometer == nil }
    var isInProgress: Bool { !isClosed && startOdometer != nil }
    var isCarryOverLoaded: Bool { isInProgress && (staysLoadedOvernight == true) }

    /// Пометить ночёвку с грузом и увеличить счётчик ночей.
    mutating func markStaysLoadedOvernight() {
        staysLoadedOvernight = true
        overnightNights = (overnightNights ?? 0) + 1
    }

    var statusText: String {
        if isClosed { return "Закрыт" }
        if isCarryOverLoaded { return "В работе · до выгрузки" }
        if isInProgress { return "В работе" }
        return "Назначен"
    }

    var dayTotalKm: Int? {
        let a = emptyKmBefore ?? 0
        let b = loadedKm ?? 0
        let c = emptyKmAfter ?? 0
        if emptyKmBefore == nil && loadedKm == nil && emptyKmAfter == nil { return nil }
        return a + b + c
    }

    init(
        id: UUID = UUID(),
        sequentialNumber: Int,
        dayNumber: Int,
        createdAt: Date = Date(),
        source: OrderSource = .driver,
        vehiclePlate: String,
        driverName: String = AppDefaults.driverName,
        customer: String = "",
        loadingAddress: String,
        unloadingAddress: String,
        routePoints: [RoutePoint]? = nil,
        startOdometer: Int? = nil,
        previousOdometer: Int? = nil,
        emptyKmBefore: Int? = nil,
        loadedKm: Int? = nil,
        emptyKmAfter: Int? = nil,
        endOdometer: Int? = nil,
        closedAt: Date? = nil,
        refueled: Bool? = nil,
        fuelPricePerLiter: Double? = nil,
        fuelLiters: Double? = nil,
        fuelTotalCost: Double? = nil,
        freight: Double? = nil,
        paymentForm: PaymentForm? = nil,
        rateWithVat: Double? = nil,
        rateWithoutVat: Double? = nil,
        rateCash: Double? = nil,
        ratePerKmCash: Double? = nil,
        estimateKm: Int? = nil,
        ratePerHourWork: Double? = nil,
        estimateWorkHours: Double? = nil,
        workHours: Double? = nil,
        salaryBonus: Double? = nil,
        vehicleRent: Double? = nil,
        driverPercent: Double = AppDefaults.driverPercent,
        earnings: Double? = nil,
        staysLoadedOvernight: Bool? = nil,
        overnightStorageRateCash: Double? = nil,
        overnightNights: Int? = nil
    ) {
        self.id = id
        self.sequentialNumber = sequentialNumber
        self.dayNumber = dayNumber
        self.createdAt = createdAt
        self.source = source
        self.vehiclePlate = vehiclePlate
        self.driverName = driverName
        self.customer = customer
        let points = Self.normalizedRoutePoints(
            routePoints ?? Self.defaultRoutePoints(loading: loadingAddress, unloading: unloadingAddress),
            loading: loadingAddress,
            unloading: unloadingAddress
        )
        self.routePoints = points
        self.loadingAddress = points.first(where: { $0.kind == .loading })?.address ?? points[0].address
        self.unloadingAddress = points.last(where: { $0.kind == .unloading })?.address
            ?? points[points.count - 1].address
        self.startOdometer = startOdometer
        self.previousOdometer = previousOdometer
        self.emptyKmBefore = emptyKmBefore
        self.loadedKm = loadedKm
        self.emptyKmAfter = emptyKmAfter
        self.endOdometer = endOdometer
        self.closedAt = closedAt
        self.refueled = refueled
        self.fuelPricePerLiter = fuelPricePerLiter
        self.fuelLiters = fuelLiters
        self.fuelTotalCost = fuelTotalCost
        self.freight = freight
        self.paymentForm = paymentForm
        self.rateWithVat = rateWithVat
        self.rateWithoutVat = rateWithoutVat
        self.rateCash = rateCash
        self.ratePerKmCash = ratePerKmCash
        self.estimateKm = estimateKm
        self.ratePerHourWork = ratePerHourWork
        self.estimateWorkHours = estimateWorkHours
        self.workHours = workHours
        self.salaryBonus = salaryBonus
        self.vehicleRent = vehicleRent
        self.driverPercent = driverPercent
        self.earnings = earnings
        self.staysLoadedOvernight = staysLoadedOvernight
        self.overnightStorageRateCash = overnightStorageRateCash
        self.overnightNights = overnightNights
    }

    enum CodingKeys: String, CodingKey {
        case id, sequentialNumber, dayNumber, createdAt, source, vehiclePlate, driverName
        case customer, loadingAddress, unloadingAddress, routePoints, startOdometer, previousOdometer
        case emptyKmBefore, loadedKm, emptyKmAfter, endOdometer, closedAt
        case refueled, fuelPricePerLiter, fuelLiters, fuelTotalCost, freight
        case paymentForm, rateWithVat, rateWithoutVat, rateCash, ratePerKmCash, estimateKm
        case ratePerHourWork, estimateWorkHours, workHours
        case salaryBonus, vehicleRent, driverPercent, earnings, staysLoadedOvernight
        case overnightStorageRateCash, overnightNights
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        sequentialNumber = try c.decode(Int.self, forKey: .sequentialNumber)
        dayNumber = try c.decode(Int.self, forKey: .dayNumber)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        source = try c.decode(OrderSource.self, forKey: .source)
        vehiclePlate = try c.decode(String.self, forKey: .vehiclePlate)
        driverName = try c.decodeIfPresent(String.self, forKey: .driverName) ?? AppDefaults.driverName
        customer = try c.decodeIfPresent(String.self, forKey: .customer) ?? ""
        let loading = try c.decode(String.self, forKey: .loadingAddress)
        let unloading = try c.decode(String.self, forKey: .unloadingAddress)
        let rawPoints: [RoutePoint]
        if let typed = try? c.decode([RoutePoint].self, forKey: .routePoints), !typed.isEmpty {
            rawPoints = typed
        } else if let strings = try? c.decode([String].self, forKey: .routePoints) {
            rawPoints = Self.migrateStringRoutePoints(strings, loading: loading, unloading: unloading)
        } else {
            rawPoints = Self.defaultRoutePoints(loading: loading, unloading: unloading)
        }
        let points = Self.normalizedRoutePoints(rawPoints, loading: loading, unloading: unloading)
        routePoints = points
        loadingAddress = points.first(where: { $0.kind == .loading })?.address ?? points[0].address
        unloadingAddress = points.last(where: { $0.kind == .unloading })?.address
            ?? points[points.count - 1].address
        startOdometer = try c.decodeIfPresent(Int.self, forKey: .startOdometer)
        previousOdometer = try c.decodeIfPresent(Int.self, forKey: .previousOdometer)
        emptyKmBefore = try c.decodeIfPresent(Int.self, forKey: .emptyKmBefore)
        loadedKm = try c.decodeIfPresent(Int.self, forKey: .loadedKm)
        emptyKmAfter = try c.decodeIfPresent(Int.self, forKey: .emptyKmAfter)
        endOdometer = try c.decodeIfPresent(Int.self, forKey: .endOdometer)
        closedAt = try c.decodeIfPresent(Date.self, forKey: .closedAt)
        refueled = try c.decodeIfPresent(Bool.self, forKey: .refueled)
        fuelPricePerLiter = try c.decodeIfPresent(Double.self, forKey: .fuelPricePerLiter)
        fuelLiters = try c.decodeIfPresent(Double.self, forKey: .fuelLiters)
        fuelTotalCost = try c.decodeIfPresent(Double.self, forKey: .fuelTotalCost)
        freight = try c.decodeIfPresent(Double.self, forKey: .freight)
        paymentForm = try c.decodeIfPresent(PaymentForm.self, forKey: .paymentForm)
        rateWithVat = try c.decodeIfPresent(Double.self, forKey: .rateWithVat)
        rateWithoutVat = try c.decodeIfPresent(Double.self, forKey: .rateWithoutVat)
        rateCash = try c.decodeIfPresent(Double.self, forKey: .rateCash)
        ratePerKmCash = try c.decodeIfPresent(Double.self, forKey: .ratePerKmCash)
        estimateKm = try c.decodeIfPresent(Int.self, forKey: .estimateKm)
        ratePerHourWork = try c.decodeIfPresent(Double.self, forKey: .ratePerHourWork)
        estimateWorkHours = try c.decodeIfPresent(Double.self, forKey: .estimateWorkHours)
        workHours = try c.decodeIfPresent(Double.self, forKey: .workHours)
        salaryBonus = try c.decodeIfPresent(Double.self, forKey: .salaryBonus)
        vehicleRent = try c.decodeIfPresent(Double.self, forKey: .vehicleRent)
        driverPercent = try c.decodeIfPresent(Double.self, forKey: .driverPercent) ?? AppDefaults.driverPercent
        earnings = try c.decodeIfPresent(Double.self, forKey: .earnings)
        staysLoadedOvernight = try c.decodeIfPresent(Bool.self, forKey: .staysLoadedOvernight)
        overnightStorageRateCash = try c.decodeIfPresent(Double.self, forKey: .overnightStorageRateCash)
        overnightNights = try c.decodeIfPresent(Int.self, forKey: .overnightNights)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(sequentialNumber, forKey: .sequentialNumber)
        try c.encode(dayNumber, forKey: .dayNumber)
        try c.encode(createdAt, forKey: .createdAt)
        try c.encode(source, forKey: .source)
        try c.encode(vehiclePlate, forKey: .vehiclePlate)
        try c.encode(driverName, forKey: .driverName)
        try c.encode(customer, forKey: .customer)
        try c.encode(loadingAddress, forKey: .loadingAddress)
        try c.encode(unloadingAddress, forKey: .unloadingAddress)
        try c.encode(routePoints, forKey: .routePoints)
        try c.encodeIfPresent(startOdometer, forKey: .startOdometer)
        try c.encodeIfPresent(previousOdometer, forKey: .previousOdometer)
        try c.encodeIfPresent(emptyKmBefore, forKey: .emptyKmBefore)
        try c.encodeIfPresent(loadedKm, forKey: .loadedKm)
        try c.encodeIfPresent(emptyKmAfter, forKey: .emptyKmAfter)
        try c.encodeIfPresent(endOdometer, forKey: .endOdometer)
        try c.encodeIfPresent(closedAt, forKey: .closedAt)
        try c.encodeIfPresent(refueled, forKey: .refueled)
        try c.encodeIfPresent(fuelPricePerLiter, forKey: .fuelPricePerLiter)
        try c.encodeIfPresent(fuelLiters, forKey: .fuelLiters)
        try c.encodeIfPresent(fuelTotalCost, forKey: .fuelTotalCost)
        try c.encodeIfPresent(freight, forKey: .freight)
        try c.encodeIfPresent(paymentForm, forKey: .paymentForm)
        try c.encodeIfPresent(rateWithVat, forKey: .rateWithVat)
        try c.encodeIfPresent(rateWithoutVat, forKey: .rateWithoutVat)
        try c.encodeIfPresent(rateCash, forKey: .rateCash)
        try c.encodeIfPresent(ratePerKmCash, forKey: .ratePerKmCash)
        try c.encodeIfPresent(estimateKm, forKey: .estimateKm)
        try c.encodeIfPresent(ratePerHourWork, forKey: .ratePerHourWork)
        try c.encodeIfPresent(estimateWorkHours, forKey: .estimateWorkHours)
        try c.encodeIfPresent(workHours, forKey: .workHours)
        try c.encodeIfPresent(salaryBonus, forKey: .salaryBonus)
        try c.encodeIfPresent(vehicleRent, forKey: .vehicleRent)
        try c.encode(driverPercent, forKey: .driverPercent)
        try c.encodeIfPresent(earnings, forKey: .earnings)
        try c.encodeIfPresent(staysLoadedOvernight, forKey: .staysLoadedOvernight)
        try c.encodeIfPresent(overnightStorageRateCash, forKey: .overnightStorageRateCash)
        try c.encodeIfPresent(overnightNights, forKey: .overnightNights)
    }
}

enum AppDefaults {
    static let driverName = "Наволоцкий Е.Н."
    static let driverPercent: Double = 30
    static let adminPin = "2580"
    static let brandName = "АРМАДА"
}

enum OrderFlowStep: String, Codable {
    case idle
    case chooseVehicle
    case arrivalOdometer
    case dayNumber
    case loadingAddress
    case unloadingAddress
    case closingOdometer
    case askRefuel
    case fuelPrice
    case fuelAmount
    case closingEmptyAfter
    case startAssignedOdometer
    case closeShiftParking
    case closeShiftStaysLoaded
}
