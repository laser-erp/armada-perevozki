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
