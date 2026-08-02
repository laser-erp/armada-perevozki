import Foundation
import SwiftUI

@MainActor
final class FormViewModel: ObservableObject {
    let questions: [Question]
    @Published var answers: [String: String] = [:]
    @Published var stepIndex: Int = 0
    @Published var isSubmitting = false
    @Published var submitError: String?
    @Published var didSucceed = false
    @Published var submissionId: String?

    private let submitter: SheetSubmitting
    private let draftStore: DraftStore

    init(
        questions: [Question] = QuestionnaireCatalog.questions,
        submitter: SheetSubmitting = GoogleSheetsService(),
        draftStore: DraftStore = .shared
    ) {
        self.questions = questions
        self.submitter = submitter
        self.draftStore = draftStore
        self.answers = draftStore.load()
    }

    var current: Question { questions[stepIndex] }
    var isFirst: Bool { stepIndex == 0 }
    var isLast: Bool { stepIndex == questions.count - 1 }
    var progress: Double {
        guard !questions.isEmpty else { return 0 }
        return Double(stepIndex + 1) / Double(questions.count)
    }

    func answer(for id: String) -> String {
        answers[id] ?? ""
    }

    func setAnswer(_ value: String, for id: String) {
        answers[id] = value
        draftStore.save(answers)
    }

    var canContinue: Bool {
        let q = current
        let value = answer(for: q.id).trimmingCharacters(in: .whitespacesAndNewlines)
        if q.required { return !value.isEmpty }
        return true
    }

    func goNext() {
        guard canContinue else { return }
        if isLast {
            Task { await submit() }
        } else {
            stepIndex += 1
        }
    }

    func goBack() {
        guard !isFirst else { return }
        stepIndex -= 1
        submitError = nil
    }

    func restart() {
        answers = [:]
        draftStore.clear()
        stepIndex = 0
        submitError = nil
        didSucceed = false
        submissionId = nil
    }

    func submit() async {
        submitError = nil
        isSubmitting = true
        defer { isSubmitting = false }

        for q in questions where q.required {
            let v = answer(for: q.id).trimmingCharacters(in: .whitespacesAndNewlines)
            if v.isEmpty {
                submitError = "Заполните обязательное поле: \(q.title)"
                if let idx = questions.firstIndex(where: { $0.id == q.id }) {
                    stepIndex = idx
                }
                return
            }
        }

        let payload = SubmissionPayload(
            id: UUID().uuidString,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            answers: answers
        )

        do {
            try await submitter.submit(payload)
            submissionId = payload.id
            didSucceed = true
            draftStore.clear()
        } catch {
            submitError = error.localizedDescription
        }
    }
}

struct SubmissionPayload: Codable {
    let id: String
    let createdAt: String
    let answers: [String: String]
}
