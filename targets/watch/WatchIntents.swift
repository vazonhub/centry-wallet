import AppIntents
import Foundation
import WatchConnectivity

// Watch-native Siri input. The watch app is otherwise read-only; these App
// Intents let you add an expense/income by voice ON THE WATCH. They don't open
// any UI — each intent sends the action to the phone over WatchConnectivity
// (transferUserInfo), reusing the existing channel the phone already listens on
// (WatchBridge.didReceiveUserInfo → JS handleWatchAction → adds to the default
// account). Deferred if the phone app is closed (delivered on its next launch).
//
// NOTE: these are separate from the iOS App Intents (plugins/withAppIntents),
// which foreground the phone app. Same phrases on each device don't collide —
// Siri on the watch uses the watch app's shortcuts, Siri on the phone the phone's.

/// Sends a watch action to the phone. Activates WCSession only if the app isn't
/// already running (in which case WatchModel owns the delegate and the session is
/// already active — we must NOT steal the delegate, just transfer).
final class WatchActionSender: NSObject, WCSessionDelegate {
  static let shared = WatchActionSender()

  private var continuation: CheckedContinuation<Void, Never>?

  func send(_ action: [String: Any]) async {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.activationState != .activated {
      // App not running: take the (nil) delegate and activate, then wait.
      if session.delegate == nil { session.delegate = self }
      await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
        self.continuation = c
        session.activate()
      }
    }
    guard session.activationState == .activated else { return }
    transfer(action)
  }

  private func transfer(_ action: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: action),
      let json = String(data: data, encoding: .utf8)
    else { return }
    WCSession.default.transferUserInfo(["action": json])
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    continuation?.resume()
    continuation = nil
  }
}

struct AddWatchExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Add expense"
  static var description = IntentDescription("Log an expense in Centry from your watch.")

  @Parameter(title: "Amount")
  var amount: Double

  @MainActor
  func perform() async throws -> some IntentResult {
    if amount > 0 {
      await WatchActionSender.shared.send(["type": "addExpense", "amountMajor": amount])
    }
    return .result()
  }
}

struct AddWatchIncomeIntent: AppIntent {
  static var title: LocalizedStringResource = "Add income"
  static var description = IntentDescription("Log income in Centry from your watch.")

  @Parameter(title: "Amount")
  var amount: Double

  @MainActor
  func perform() async throws -> some IntentResult {
    if amount > 0 {
      await WatchActionSender.shared.send(["type": "addIncome", "amountMajor": amount])
    }
    return .result()
  }
}

/// Registers the watch's Siri phrases. English-first (primary Siri language) with
/// Russian kept (the watch app declares both localizations, see Info.plist).
struct CentryWatchShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddWatchExpenseIntent(),
      phrases: [
        "Add expense to \(.applicationName)",
        "Log an expense in \(.applicationName)",
        "\(.applicationName) expense",
        "Добавить трату в \(.applicationName)",
        "Записать расход в \(.applicationName)",
      ],
      shortTitle: "Add expense",
      systemImageName: "minus.circle"
    )
    AppShortcut(
      intent: AddWatchIncomeIntent(),
      phrases: [
        "Add income to \(.applicationName)",
        "Log income in \(.applicationName)",
        "\(.applicationName) income",
        "Добавить доход в \(.applicationName)",
        "Записать доход в \(.applicationName)",
      ],
      shortTitle: "Add income",
      systemImageName: "plus.circle"
    )
  }
}
