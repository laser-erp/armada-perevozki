import Foundation

protocol SheetSubmitting {
    func submit(_ payload: SubmissionPayload) async throws
}

enum SheetConfig {
    /// Вставьте URL веб-приложения Google Apps Script после публикации.
    /// Файл → Поделиться → Развернуть как веб-приложение.
    static var webAppURL: String {
        UserDefaults.standard.string(forKey: "sheets_web_app_url")?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        ?? ""
    }

    static func saveWebAppURL(_ url: String) {
        UserDefaults.standard.set(url.trimmingCharacters(in: .whitespacesAndNewlines), forKey: "sheets_web_app_url")
    }
}

enum SheetError: LocalizedError {
    case missingURL
    case badURL
    case server(String)
    case http(Int)

    var errorDescription: String? {
        switch self {
        case .missingURL:
            return "Не задан адрес Google Таблицы. Откройте «Настройки» и вставьте URL Apps Script."
        case .badURL:
            return "Некорректный URL веб-приложения."
        case .server(let message):
            return message
        case .http(let code):
            return "Ошибка сервера (\(code)). Проверьте публикацию Apps Script."
        }
    }
}

final class GoogleSheetsService: SheetSubmitting {
    func submit(_ payload: SubmissionPayload) async throws {
        let urlString = SheetConfig.webAppURL
        guard !urlString.isEmpty else { throw SheetError.missingURL }
        guard let url = URL(string: urlString) else { throw SheetError.badURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        let body = EncodableBody(
            id: payload.id,
            createdAt: payload.createdAt,
            columnOrder: QuestionnaireCatalog.sheetColumnIds,
            answers: payload.answers
        )
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw SheetError.server("Нет ответа от сервера")
        }
        guard (200...299).contains(http.statusCode) else {
            throw SheetError.http(http.statusCode)
        }

        if let decoded = try? JSONDecoder().decode(ScriptResponse.self, from: data),
           decoded.ok == false {
            throw SheetError.server(decoded.error ?? "Ошибка записи в таблицу")
        }
    }
}

private struct EncodableBody: Encodable {
    let id: String
    let createdAt: String
    let columnOrder: [String]
    let answers: [String: String]
}

private struct ScriptResponse: Decodable {
    let ok: Bool?
    let error: String?
}

final class DraftStore {
    static let shared = DraftStore()
    private let key = "driver_form_draft"

    func load() -> [String: String] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let dict = try? JSONDecoder().decode([String: String].self, from: data) else {
            return [:]
        }
        return dict
    }

    func save(_ answers: [String: String]) {
        if let data = try? JSONEncoder().encode(answers) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    func clear() {
        UserDefaults.standard.removeObject(forKey: key)
    }
}
