import Foundation
import SwiftUI
import WatchConnectivity
import WidgetKit

// The watch-side WatchConnectivity endpoint + view model. Receives the phone's
// payload as the application context (latest-state mirror), caches it to the
// watch-side App Group (shared with the complication target), and sends actions
// back via transferUserInfo.
//
// NOTE: the App Group here (`…centry.watch`) is on the WATCH device — separate
// from the iOS App Group. It only links the watch app and its complication.
let kWatchGroup = "group.by.vazon.centry.watch"
let kPayloadKey = "payload"

final class WatchModel: NSObject, ObservableObject, WCSessionDelegate {
  @Published var payload: WatchPayload = .placeholder

  override init() {
    super.init()
    if let json = UserDefaults(suiteName: kWatchGroup)?.string(forKey: kPayloadKey),
      let cached = WatchPayload.decode(from: json)
    {
      payload = cached
      WatchLang.apply(cached.language)
    }
    if WCSession.isSupported() {
      let session = WCSession.default
      session.delegate = self
      session.activate()
    }
  }

  private func apply(_ context: [String: Any]) {
    guard let json = context["payload"] as? String,
      let decoded = WatchPayload.decode(from: json)
    else { return }
    UserDefaults(suiteName: kWatchGroup)?.set(json, forKey: kPayloadKey)
    WidgetCenter.shared.reloadAllTimelines()  // refresh the complication
    DispatchQueue.main.async {
      WatchLang.apply(decoded.language)  // mirror the phone's RU/EN choice
      self.payload = decoded
    }
  }

  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    apply(applicationContext)
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated {
      apply(session.receivedApplicationContext)
    }
  }

  // --- Actions sent back to the phone (queued, reliable) ---
  private func send(_ action: [String: Any]) {
    guard WCSession.isSupported() else { return }
    if let data = try? JSONSerialization.data(withJSONObject: action),
      let json = String(data: data, encoding: .utf8)
    {
      WCSession.default.transferUserInfo(["action": json])
    }
  }

  func addExpense(amountMajor: Int) {
    send(["type": "addExpense", "amountMajor": amountMajor])
  }

  func addIncome(amountMajor: Int) {
    send(["type": "addIncome", "amountMajor": amountMajor])
  }

  func setBudget(amountMajor: Int) {
    send(["type": "setBudget", "amountMajor": amountMajor])
  }
}

// Watch palette — colour means one thing (rule 6): red = overspent, green = income.
enum WatchTheme {
  static let ink = Color.white
  static let dim = Color(white: 0.62)
  static let pos = Color(red: 0.30, green: 0.87, blue: 0.50)
  static let neg = Color(red: 1.0, green: 0.42, blue: 0.38)
  static let accent = Color(red: 0.62, green: 0.69, blue: 1.0)
  static let chip = Color(white: 0.14)

  static func heroColor(remainingMinor: Int) -> Color {
    remainingMinor < 0 ? neg : ink
  }
}
