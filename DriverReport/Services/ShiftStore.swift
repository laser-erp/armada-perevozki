import Foundation

enum FleetCatalog {
    static let plates: [String] = VehicleProfile.defaults.map(\.plate)
}

@MainActor
final class ShiftStore: ObservableObject {
    @Published private(set) var shifts: [ShiftRecord] = []
    @Published private(set) var orders: [OrderRecord] = []
    @Published private(set) var vehicles: [VehicleProfile] = VehicleProfile.defaults
    @Published private(set) var drivers: [DriverProfile] = DriverProfile.defaults
    @Published private(set) var financeSettings: FinanceSettings = .default

    private let shiftsKey = "driver_shifts_v4"
    private let ordersKey = "driver_orders_v4"
    private let vehiclesKey = "driver_vehicles_v4"
    private let driversKey = "driver_drivers_v4"
    private let financeKey = "driver_finance_v1"
    private let seqKey = "driver_order_seq_v1"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        load()
    }

    func upsert(_ shift: ShiftRecord) {
        if let index = shifts.firstIndex(where: { $0.id == shift.id }) {
            shifts[index] = shift
        } else {
            shifts.insert(shift, at: 0)
        }
        persist()
    }

    func upsertOrder(_ order: OrderRecord) {
        var updated = order
        updated = recalculated(updated)
        if let index = orders.firstIndex(where: { $0.id == updated.id }) {
            orders[index] = updated
        } else {
            orders.insert(updated, at: 0)
        }
        for sIdx in shifts.indices {
            if let oIdx = shifts[sIdx].orders.firstIndex(where: { $0.id == updated.id }) {
                shifts[sIdx].orders[oIdx] = updated
            }
        }
        persist()
    }

    func attachOrder(_ order: OrderRecord, to shiftId: UUID) {
        var updated = recalculated(order)
        guard let sIdx = shifts.firstIndex(where: { $0.id == shiftId }) else {
            upsertOrder(updated)
            return
        }
        if let oIdx = shifts[sIdx].orders.firstIndex(where: { $0.id == updated.id }) {
            shifts[sIdx].orders[oIdx] = updated
        } else {
            shifts[sIdx].orders.append(updated)
        }
        upsertOrder(updated)
    }

    func allShifts() -> [ShiftRecord] {
        shifts.sorted { $0.startedAt > $1.startedAt }
    }

    /// Открытая смена (ещё не закрыта одометром на стоянке).
    func openShift() -> ShiftRecord? {
        allShifts().first { !$0.isClosed }
    }

    func allOrders() -> [OrderRecord] {
        orders.sorted { $0.createdAt > $1.createdAt }
    }

    func assignedPending(for driver: String = AppDefaults.driverName) -> [OrderRecord] {
        allOrders().filter { $0.isAssignedPending && $0.driverName == driver }
    }

    func inProgressOrder(for driver: String = AppDefaults.driverName) -> OrderRecord? {
        allOrders().first { $0.isInProgress && $0.driverName == driver }
    }

    func nextSequentialNumber() -> Int {
        let current = UserDefaults.standard.integer(forKey: seqKey)
        let next = current + 1
        UserDefaults.standard.set(next, forKey: seqKey)
        return next
    }

    func vehicle(for plate: String) -> VehicleProfile {
        vehicles.first { $0.plate == plate }
            ?? VehicleProfile(plate: plate, consumptionPer100Km: 20)
    }

    func driver(for name: String) -> DriverProfile {
        drivers.first { $0.name == name }
            ?? DriverProfile(name: name, salaryPercent: AppDefaults.driverPercent)
    }

    func updateVehicle(_ vehicle: VehicleProfile) {
        if let i = vehicles.firstIndex(where: { $0.plate == vehicle.plate }) {
            vehicles[i] = vehicle
        } else {
            vehicles.append(vehicle)
        }
        persist()
        // refresh finance on related orders
        for order in orders where order.vehiclePlate == vehicle.plate {
            upsertOrder(order)
        }
    }

    func updateDriver(_ profile: DriverProfile) {
        if let i = drivers.firstIndex(where: { $0.name == profile.name }) {
            drivers[i] = profile
        } else {
            drivers.append(profile)
        }
        persist()
        for order in orders where order.driverName == profile.name {
            var o = order
            o.driverPercent = profile.salaryPercent
            upsertOrder(o)
        }
    }

    func updateFinanceSettings(_ settings: FinanceSettings) {
        var s = settings
        if s.markupPercent < 0 { s.markupPercent = 0 }
        if s.markupPercent > 80 { s.markupPercent = 80 }
        financeSettings = s
        persist()
    }

    func createDispatcherOrder(
        dayNumber: Int,
        vehiclePlate: String,
        driverName: String,
        customer: String,
        loadingAddress: String,
        unloadingAddress: String
    ) -> OrderRecord {
        let percent = driver(for: driverName).salaryPercent
        let order = OrderRecord(
            sequentialNumber: nextSequentialNumber(),
            dayNumber: dayNumber,
            source: .dispatcher,
            vehiclePlate: vehiclePlate,
            driverName: driverName,
            customer: customer,
            loadingAddress: loadingAddress,
            unloadingAddress: unloadingAddress,
            driverPercent: percent
        )
        upsertOrder(order)
        return order
    }

    func recalculated(_ order: OrderRecord) -> OrderRecord {
        var o = order
        let consumption = vehicle(for: o.vehiclePlate).consumptionPer100Km
        if let km = OrderFinance.kmParkingToEnd(o) {
            let liters = OrderFinance.fuelLiters(km: km, consumptionPer100: consumption)
            // keep factual refill separate; calculated consumption stored in fuelLiters when no refill override needed
            // Use calculated liters for GCM column; if driver refueled, price from refill
            if o.fuelLiters == nil || o.refueled != true {
                // only auto-fill calculated liters for display via computed in UI;
            }
            _ = liters
        }
        OrderFinance.applyPerKmCash(to: &o)
        if let rate = OrderFinance.selectedRate(o) {
            let bonus = o.salaryBonus ?? 0
            o.earnings = OrderFinance.round2(
                OrderFinance.driverPay(rate: rate, percent: o.driverPercent, bonus: bonus)
            )
            if o.freight == nil { o.freight = rate }
        }
        return o
    }

    /// Snapshot metrics for admin table row.
    func metrics(for order: OrderRecord) -> OrderMetrics {
        let consumption = vehicle(for: order.vehiclePlate).consumptionPer100Km
        let km = OrderFinance.kmParkingToEnd(order)
        let calcLiters = km.map { OrderFinance.fuelLiters(km: $0, consumptionPer100: consumption) }
        let price = order.fuelPricePerLiter
        let fuelCost = (calcLiters != nil && price != nil)
            ? OrderFinance.round2(calcLiters! * price!)
            : order.fuelTotalCost
        let rate = OrderFinance.selectedRate(order)
        let cushion = rate.map { OrderFinance.round2(OrderFinance.cushion(rate: $0)) }
        let bonus = order.salaryBonus ?? 0
        let pay = rate.map {
            OrderFinance.round2(OrderFinance.driverPay(rate: $0, percent: order.driverPercent, bonus: bonus))
        }
        let rent = order.vehicleRent ?? 0
        let fuel = fuelCost ?? 0
        let fixed = OrderFinance.fixedCosts(fuelCost: fuel, rent: rent, bonus: bonus)
        let breakEven = OrderFinance.breakEvenRate(fixedCosts: fixed, driverPercent: order.driverPercent)
        let recommended = OrderFinance.recommendedRate(
            fixedCosts: fixed,
            driverPercent: order.driverPercent,
            markupPercent: financeSettings.markupPercent
        )
        let totalCost = rate.map {
            OrderFinance.totalCost(
                rate: $0,
                fuelCost: fuel,
                rent: rent,
                driverPercent: order.driverPercent,
                bonus: bonus
            )
        }
        let profit: Double? = {
            guard let rate, let pay, let cushion else { return nil }
            return OrderFinance.round2(
                OrderFinance.netProfit(
                    rate: rate,
                    driverPay: pay,
                    cushion: cushion,
                    fuelCost: fuel,
                    rent: rent
                )
            )
        }()
        let perKm = OrderFinance.costPerKmWithoutVat(
            rateWithoutVat: order.rateWithoutVat,
            loadedKm: order.loadedKm
        ).map(OrderFinance.round2)

        return OrderMetrics(
            kmParkingToEnd: km,
            fuelLitersCalc: calcLiters.map(OrderFinance.round2),
            fuelCostCalc: fuelCost,
            selectedRate: rate,
            cushion: cushion,
            driverPay: pay,
            costPerKmNoVat: perKm,
            netProfit: profit,
            consumptionPer100: consumption,
            fixedCosts: OrderFinance.round2(fixed),
            totalCost: totalCost,
            breakEvenRate: breakEven,
            recommendedRate: recommended,
            markupPercent: financeSettings.markupPercent
        )
    }

    private func persist() {
        if let data = try? encoder.encode(shifts) {
            UserDefaults.standard.set(data, forKey: shiftsKey)
        }
        if let data = try? encoder.encode(orders) {
            UserDefaults.standard.set(data, forKey: ordersKey)
        }
        if let data = try? encoder.encode(vehicles) {
            UserDefaults.standard.set(data, forKey: vehiclesKey)
        }
        if let data = try? encoder.encode(drivers) {
            UserDefaults.standard.set(data, forKey: driversKey)
        }
        if let data = try? encoder.encode(financeSettings) {
            UserDefaults.standard.set(data, forKey: financeKey)
        }
    }

    private func load() {
        if let data = UserDefaults.standard.data(forKey: shiftsKey),
           let decoded = try? decoder.decode([ShiftRecord].self, from: data) {
            shifts = decoded
        } else {
            shifts = []
        }
        if let data = UserDefaults.standard.data(forKey: ordersKey),
           let decoded = try? decoder.decode([OrderRecord].self, from: data) {
            orders = decoded
        } else {
            orders = []
        }
        if let data = UserDefaults.standard.data(forKey: vehiclesKey),
           let decoded = try? decoder.decode([VehicleProfile].self, from: data), !decoded.isEmpty {
            vehicles = decoded
        } else {
            vehicles = VehicleProfile.defaults
        }
        if let data = UserDefaults.standard.data(forKey: driversKey),
           let decoded = try? decoder.decode([DriverProfile].self, from: data), !decoded.isEmpty {
            drivers = decoded
        } else {
            drivers = DriverProfile.defaults
        }
        if let data = UserDefaults.standard.data(forKey: financeKey),
           let decoded = try? decoder.decode(FinanceSettings.self, from: data) {
            financeSettings = decoded
        } else {
            financeSettings = .default
        }
    }
}

struct OrderMetrics {
    var kmParkingToEnd: Int?
    var fuelLitersCalc: Double?
    var fuelCostCalc: Double?
    var selectedRate: Double?
    var cushion: Double?
    var driverPay: Double?
    var costPerKmNoVat: Double?
    var netProfit: Double?
    var consumptionPer100: Double
    var fixedCosts: Double
    var totalCost: Double?
    var breakEvenRate: Double?
    var recommendedRate: Double?
    var markupPercent: Double
}
