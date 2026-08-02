import SwiftUI

@main
struct DriverReportApp: App {
    @StateObject private var store = ShiftStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
        }
    }
}
