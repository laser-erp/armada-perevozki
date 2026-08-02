import SwiftUI

enum AppRoute: Equatable {
    case splash
    case roleSelect
    case adminPin
    case admin
    case driver
}

struct RootView: View {
    @EnvironmentObject private var store: ShiftStore
    @State private var route: AppRoute = .splash

    var body: some View {
        Group {
            switch route {
            case .splash:
                SplashView {
                    withAnimation(.easeInOut(duration: 0.35)) {
                        route = .roleSelect
                    }
                }
            case .roleSelect:
                RoleSelectView(
                    onDriver: { route = .driver },
                    onAdmin: { route = .adminPin }
                )
            case .adminPin:
                AdminPinView(
                    onSuccess: { route = .admin },
                    onBack: { route = .roleSelect }
                )
            case .admin:
                AdminHomeView(store: store, onExit: { route = .roleSelect })
            case .driver:
                DriverShellView(store: store, onExit: { route = .roleSelect })
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct SplashView: View {
    let onFinished: () -> Void
    @State private var opacity: Double = 0
    @State private var scale: CGFloat = 0.92

    var body: some View {
        ZStack {
            LinearGradient(colors: [AppTheme.canvasTop, AppTheme.canvasBottom], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 18) {
                Image("AppLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 120, height: 60)
                Text(AppDefaults.brandName)
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(AppTheme.textPrimary)
                    .tracking(4)
                Text("Учёт перевозок")
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(AppTheme.textMuted)
            }
            .opacity(opacity)
            .scaleEffect(scale)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.55)) {
                opacity = 1
                scale = 1
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
                onFinished()
            }
        }
    }
}

struct RoleSelectView: View {
    let onDriver: () -> Void
    let onAdmin: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(colors: [AppTheme.canvasTop, AppTheme.canvasBottom], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 24) {
                Spacer()
                Image("AppLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 100, height: 50)
                Text(AppDefaults.brandName)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .tracking(3)
                Text("Выберите роль")
                    .font(.system(.body, design: .rounded))
                    .foregroundStyle(AppTheme.textMuted)

                VStack(spacing: 12) {
                    PrimaryButton(title: "Водитель", action: onDriver)
                    PrimaryButton(title: "Администратор", style: .secondary, action: onAdmin)
                }
                .padding(.horizontal, 24)
                Spacer()
            }
            .foregroundStyle(AppTheme.textPrimary)
        }
    }
}

struct AdminPinView: View {
    let onSuccess: () -> Void
    let onBack: () -> Void
    @State private var pin = ""
    @State private var error: String?

    var body: some View {
        ZStack {
            AppTheme.canvasTop.ignoresSafeArea()
            VStack(spacing: 16) {
                HStack {
                    Button("Назад", action: onBack)
                        .foregroundStyle(AppTheme.accent)
                    Spacer()
                }
                .padding(.horizontal)

                Spacer()
                Text("Вход администратора")
                    .font(.system(.title2, design: .rounded).weight(.bold))
                Text("Введите PIN")
                    .foregroundStyle(AppTheme.textMuted)

                SecureField("••••", text: $pin)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.center)
                    .font(.system(size: 28, weight: .semibold, design: .rounded))
                    .padding()
                    .background(AppTheme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.horizontal, 40)

                if let error {
                    Text(error).foregroundStyle(.red).font(.caption)
                }

                PrimaryButton(title: "Войти") {
                    if pin == AppDefaults.adminPin {
                        onSuccess()
                    } else {
                        error = "Неверный PIN"
                    }
                }
                .padding(.horizontal, 40)
                Spacer()
            }
            .foregroundStyle(AppTheme.textPrimary)
        }
    }
}

struct DriverShellView: View {
    @ObservedObject var store: ShiftStore
    let onExit: () -> Void
    @StateObject private var chatHolder = ChatHolder()

    var body: some View {
        NavigationStack {
            Group {
                if let viewModel = chatHolder.viewModel {
                    ChatView(viewModel: viewModel)
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Водитель")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Выход", action: onExit)
                        .foregroundStyle(AppTheme.accent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 10) {
                        NavigationLink("Кабинет") {
                            DriverCabinetView(store: store)
                        }
                        NavigationLink("Заявки") {
                            OrdersListView(store: store, adminMode: false)
                        }
                        NavigationLink("Смены") {
                            ShiftsListView(store: store)
                        }
                    }
                    .foregroundStyle(AppTheme.accent)
                }
            }
            .onAppear { chatHolder.bind(store: store) }
        }
        .tint(AppTheme.accent)
    }
}

@MainActor
final class ChatHolder: ObservableObject {
    @Published var viewModel: ChatViewModel?

    func bind(store: ShiftStore) {
        guard viewModel == nil else { return }
        viewModel = ChatViewModel(store: store)
    }
}
