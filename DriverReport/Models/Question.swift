import Foundation

enum AnswerType: Equatable {
    case text(placeholder: String, keyboard: TextKeyboard = .default)
    case multiline(placeholder: String)
    case singleChoice([String])
    case number(placeholder: String)
    case date
}

enum TextKeyboard {
    case `default`, phone, number, email
}

struct Question: Identifiable, Equatable {
    let id: String
    let title: String
    let hint: String?
    let required: Bool
    let type: AnswerType
}

/// Вопросы анкеты. Подставьте те же, что были в Telegram-боте.
enum QuestionnaireCatalog {
    static let questions: [Question] = [
        Question(
            id: "driver_name",
            title: "Ваше ФИО",
            hint: "Как в путевом листе",
            required: true,
            type: .text(placeholder: "Иванов Иван Иванович")
        ),
        Question(
            id: "phone",
            title: "Номер телефона",
            hint: nil,
            required: true,
            type: .text(placeholder: "+7 900 000-00-00", keyboard: .phone)
        ),
        Question(
            id: "vehicle",
            title: "Госномер автомобиля",
            hint: "Буквы и цифры без пробелов",
            required: true,
            type: .text(placeholder: "А123ВС777")
        ),
        Question(
            id: "shift_date",
            title: "Дата смены",
            hint: nil,
            required: true,
            type: .date
        ),
        Question(
            id: "route",
            title: "Маршрут / объект",
            hint: "Куда едете или где находитесь",
            required: true,
            type: .text(placeholder: "Склад → клиент")
        ),
        Question(
            id: "status",
            title: "Статус",
            hint: nil,
            required: true,
            type: .singleChoice([
                "На линии",
                "Погрузка",
                "Разгрузка",
                "Простой",
                "Ремонт",
                "ДТП / ЧП",
                "Смена завершена"
            ])
        ),
        Question(
            id: "odometer",
            title: "Показания одометра, км",
            hint: "Текущий пробег",
            required: false,
            type: .number(placeholder: "125430")
        ),
        Question(
            id: "comment",
            title: "Комментарий",
            hint: "Необязательно",
            required: false,
            type: .multiline(placeholder: "Что важно сообщить диспетчеру")
        )
    ]

    /// Порядок колонок в Google Таблице (после метки времени и ID отправки).
    static var sheetColumnIds: [String] {
        questions.map(\.id)
    }
}
