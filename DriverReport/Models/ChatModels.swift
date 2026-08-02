import Foundation

enum ChatAuthor: String, Codable {
    case bot
    case driver
}

enum FluidLevel: String, Codable, CaseIterable, Identifiable {
    case maximum = "Максимум"
    case middle = "Середина"
    case minimum = "Минимум"

    var id: String { rawValue }

    var detail: String {
        switch self {
        case .maximum: return "надпись MAX"
        case .middle: return "между MAX и MIN"
        case .minimum: return "надпись MIN"
        }
    }
}

enum YesNo: String, Codable, CaseIterable, Identifiable {
    case yes = "Да"
    case no = "Нет"

    var id: String { rawValue }
}

struct ChatMessage: Identifiable, Codable, Equatable {
    let id: UUID
    let author: ChatAuthor
    let text: String
    let createdAt: Date

    init(id: UUID = UUID(), author: ChatAuthor, text: String, createdAt: Date = Date()) {
        self.id = id
        self.author = author
        self.text = text
        self.createdAt = createdAt
    }
}

enum InputMode: Equatable {
    case none
    case openShift
    case chooseVehicle([String])
    case number(placeholder: String)
    case fluidLevel(title: String)
    case lightChecklist
    case afterETO
    case dayOrderNumber
    case text(placeholder: String)
    case yesNo(prompt: String)
}

struct LightChecklistAnswers: Codable, Equatable {
    var lowBeam: YesNo?
    var brakeLights: YesNo?
    var turnSignals: YesNo?

    var isComplete: Bool {
        lowBeam != nil && brakeLights != nil && turnSignals != nil
    }
}

struct ShiftRecord: Identifiable, Codable, Equatable {
    let id: UUID
    let startedAt: Date
    var vehiclePlate: String?
    var odometer: Int?
    var fuelLiters: Double?
    var powerSteeringLevel: FluidLevel?
    var coolantLevel: FluidLevel?
    var lights: LightChecklistAnswers
    var engineOilLevel: FluidLevel?
    var completedAt: Date?
    var messages: [ChatMessage]
    var orders: [OrderRecord]
    /// Last known odometer for empty-km chain (ETO exit or last order point).
    var lastOdometerPoint: Int?
    /// Одометр по возвращении на стоянку (закрытие смены).
    var parkingOdometer: Int?
    var endedAt: Date?

    init(
        id: UUID = UUID(),
        startedAt: Date = Date(),
        vehiclePlate: String? = nil,
        odometer: Int? = nil,
        fuelLiters: Double? = nil,
        powerSteeringLevel: FluidLevel? = nil,
        coolantLevel: FluidLevel? = nil,
        lights: LightChecklistAnswers = LightChecklistAnswers(),
        engineOilLevel: FluidLevel? = nil,
        completedAt: Date? = nil,
        messages: [ChatMessage] = [],
        orders: [OrderRecord] = [],
        lastOdometerPoint: Int? = nil,
        parkingOdometer: Int? = nil,
        endedAt: Date? = nil
    ) {
        self.id = id
        self.startedAt = startedAt
        self.vehiclePlate = vehiclePlate
        self.odometer = odometer
        self.fuelLiters = fuelLiters
        self.powerSteeringLevel = powerSteeringLevel
        self.coolantLevel = coolantLevel
        self.lights = lights
        self.engineOilLevel = engineOilLevel
        self.completedAt = completedAt
        self.messages = messages
        self.orders = orders
        self.lastOdometerPoint = lastOdometerPoint
        self.parkingOdometer = parkingOdometer
        self.endedAt = endedAt
    }

    var isETOComplete: Bool {
        if completedAt != nil { return true }
        return vehiclePlate != nil
            && odometer != nil
            && fuelLiters != nil
            && powerSteeringLevel != nil
            && coolantLevel != nil
            && engineOilLevel != nil
    }
    var isClosed: Bool { endedAt != nil }
}

enum ETOStep: Int, Codable {
    case idle
    case chooseVehicle
    case odometer
    case fuel
    case powerSteering
    case coolant
    case lights
    case engineOil
    case done
}
