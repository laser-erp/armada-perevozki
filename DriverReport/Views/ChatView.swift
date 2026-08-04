import SwiftUI

struct ChatView: View {
    @ObservedObject var viewModel: ChatViewModel

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [AppTheme.canvasTop, AppTheme.canvasBottom],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                DriverOrderBanner(viewModel: viewModel)
                    .padding(.horizontal, 12)
                    .padding(.top, 8)

                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            ForEach(viewModel.messages) { message in
                                MessageBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 20)
                    }
                    .onChange(of: viewModel.messages.count) { _, _ in
                        if let last = viewModel.messages.last {
                            withAnimation(.easeOut(duration: 0.25)) {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }

                Divider().overlay(Color.white.opacity(0.12))

                InputBar(viewModel: viewModel)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(AppTheme.canvasTop.opacity(0.95))
            }
        }
    }
}

struct DriverOrderBanner: View {
    @ObservedObject var viewModel: ChatViewModel

    var body: some View {
        VStack(spacing: 8) {
            if let enRoute = viewModel.enRouteOrder {
                bannerCard(
                    title: "Заказ №\(enRoute.sequentialNumber) — вы в пути",
                    subtitle: "\(enRoute.routeText)\nНе забудьте отметить прибытие на загрузку (одометр).",
                    button: "Прибыл на загрузку"
                ) {
                    _ = viewModel.beginArriveOrder(enRoute)
                }
            }
            ForEach(viewModel.assignedPending) { order in
                bannerCard(
                    title: "Заказ №\(order.sequentialNumber) назначен",
                    subtitle: "\(order.routeText)\nПеред выездом со стоянки нажмите «Выехал» и введите одометр.",
                    button: "Выехал"
                ) {
                    _ = viewModel.beginDepartOrder(order)
                }
            }
        }
    }

    @ViewBuilder
    private func bannerCard(title: String, subtitle: String, button: String, action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(.headline, design: .rounded))
                .foregroundStyle(AppTheme.textPrimary)
            Text(subtitle)
                .font(.system(.caption, design: .rounded))
                .foregroundStyle(AppTheme.textMuted)
            PrimaryButton(title: button, action: action)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [AppTheme.accent.opacity(0.28), AppTheme.accent.opacity(0.08)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AppTheme.accent.opacity(0.55), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct MessageBubble: View {
    let message: ChatMessage

    private var isBot: Bool { message.author == .bot }

    var body: some View {
        HStack {
            if !isBot { Spacer(minLength: 48) }

            Text(message.text)
                .font(.system(.body, design: .rounded))
                .foregroundStyle(isBot ? AppTheme.textPrimary : Color(red: 0.12, green: 0.12, blue: 0.1))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isBot ? AppTheme.botBubble : AppTheme.driverBubble)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

            if isBot { Spacer(minLength: 48) }
        }
        .transition(.opacity.combined(with: .move(edge: isBot ? .leading : .trailing)))
    }
}

struct InputBar: View {
    @ObservedObject var viewModel: ChatViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let error = viewModel.numberError {
                Text(error)
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(.red.opacity(0.9))
            }

            switch viewModel.inputMode {
            case .openShift:
                PrimaryButton(title: "Открыть смену") {
                    viewModel.openShift()
                }

            case .chooseVehicle(let plates):
                VStack(spacing: 8) {
                    ForEach(plates, id: \.self) { plate in
                        PrimaryButton(title: plate, style: .secondary) {
                            viewModel.selectVehicle(plate)
                        }
                    }
                }

            case .number(let placeholder):
                HStack(spacing: 8) {
                    TextField(placeholder, text: $viewModel.draftNumber)
                        .keyboardType(.decimalPad)
                        .font(.system(.body, design: .rounded))
                        .padding(12)
                        .background(AppTheme.field)
                        .foregroundStyle(AppTheme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Button("OK") {
                        viewModel.submitNumber()
                    }
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(Color(red: 0.12, green: 0.12, blue: 0.1))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

            case .fluidLevel(let title):
                Text(title)
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(AppTheme.textMuted)
                VStack(spacing: 8) {
                    ForEach(FluidLevel.allCases) { level in
                        PrimaryButton(title: level.rawValue, style: .secondary) {
                            viewModel.selectFluid(level)
                        }
                    }
                }

            case .lightChecklist:
                LightChecklistPanel(viewModel: viewModel)

            case .yesNo:
                HStack(spacing: 8) {
                    PrimaryButton(title: "Да") {
                        viewModel.answerYesNo(true)
                    }
                    PrimaryButton(title: "Нет", style: .secondary) {
                        viewModel.answerYesNo(false)
                    }
                }

            case .afterETO:
                VStack(spacing: 8) {
                    if let open = viewModel.openOrder {
                        if open.isCarryOverLoaded {
                            Text("Заказ №\(open.sequentialNumber) перенесён (машина загружена) — закройте после выгрузки.")
                                .font(.system(.caption, design: .rounded))
                                .foregroundStyle(AppTheme.textMuted)
                        }
                        PrimaryButton(title: "Закрыть заказ") {
                            viewModel.startCloseOrder()
                        }
                        PrimaryButton(title: "Закрыть смену", style: .secondary) {
                            viewModel.startCloseShift()
                        }
                    } else if let enRoute = viewModel.enRouteOrder {
                        Text("Заказ №\(enRoute.sequentialNumber) — выехали. Отметьте прибытие на загрузку.")
                            .font(.system(.caption, design: .rounded))
                            .foregroundStyle(AppTheme.accent)
                        PrimaryButton(title: "Прибыл на загрузку №\(enRoute.sequentialNumber)") {
                            viewModel.beginArriveOrder(enRoute)
                        }
                        PrimaryButton(title: "Закрыть смену", style: .secondary) {
                            viewModel.startCloseShift()
                        }
                    } else {
                        ForEach(viewModel.assignedPending) { order in
                            PrimaryButton(title: "Выехал · заказ №\(order.sequentialNumber)") {
                                viewModel.beginDepartOrder(order)
                            }
                        }
                        PrimaryButton(title: "Создать заказ сам", style: .secondary) {
                            viewModel.startCreateOrder()
                        }
                        PrimaryButton(title: "Закрыть смену") {
                            viewModel.startCloseShift()
                        }
                    }
                    if viewModel.canStartNewShift {
                        PrimaryButton(title: "Новая смена", style: .secondary) {
                            viewModel.startNewShift()
                        }
                    }
                }

            case .dayOrderNumber:
                Text("Номер заказа за день")
                    .font(.system(.caption, design: .rounded))
                    .foregroundStyle(AppTheme.textMuted)
                HStack(spacing: 8) {
                    ForEach(1...5, id: \.self) { n in
                        Button("\(n)") {
                            viewModel.selectDayOrderNumber(n)
                        }
                        .font(.system(.headline, design: .rounded))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(AppTheme.field)
                        .foregroundStyle(AppTheme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }

            case .text(let placeholder):
                HStack(alignment: .top, spacing: 8) {
                    TextField(placeholder, text: $viewModel.draftText, axis: .vertical)
                        .lineLimit(2...4)
                        .font(.system(.body, design: .rounded))
                        .padding(12)
                        .background(AppTheme.field)
                        .foregroundStyle(AppTheme.textPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Button("OK") {
                        viewModel.submitText()
                    }
                    .font(.system(.headline, design: .rounded))
                    .foregroundStyle(Color(red: 0.12, green: 0.12, blue: 0.1))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(AppTheme.accent)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

            case .none:
                EmptyView()
            }
        }
    }
}

struct LightChecklistPanel: View {
    @ObservedObject var viewModel: ChatViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            checklistRow(
                title: "Ближний свет",
                value: viewModel.lightDraft.lowBeam
            ) { viewModel.setLight(lowBeam: $0) }

            checklistRow(
                title: "Стоп-сигналы",
                value: viewModel.lightDraft.brakeLights
            ) { viewModel.setLight(brakeLights: $0) }

            checklistRow(
                title: "Указатели поворотов",
                value: viewModel.lightDraft.turnSignals
            ) { viewModel.setLight(turnSignals: $0) }

            PrimaryButton(title: "Отправить") {
                viewModel.submitLights()
            }
            .opacity(viewModel.lightDraft.isComplete ? 1 : 0.45)
            .disabled(!viewModel.lightDraft.isComplete)
        }
    }

    private func checklistRow(
        title: String,
        value: YesNo?,
        onSelect: @escaping (YesNo) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(.subheadline, design: .rounded))
                .foregroundStyle(AppTheme.textPrimary)
            HStack(spacing: 8) {
                ForEach(YesNo.allCases) { option in
                    Button(option.rawValue) {
                        onSelect(option)
                    }
                    .font(.system(.callout, design: .rounded).weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(value == option ? AppTheme.accent : AppTheme.field)
                    .foregroundStyle(value == option ? Color(red: 0.12, green: 0.12, blue: 0.1) : AppTheme.textPrimary)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
            }
        }
    }
}

struct PrimaryButton: View {
    enum Style { case primary, secondary }

    let title: String
    var style: Style = .primary
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(.headline, design: .rounded))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(style == .primary ? AppTheme.accent : AppTheme.field)
                .foregroundStyle(style == .primary ? Color(red: 0.12, green: 0.12, blue: 0.1) : AppTheme.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}
