import ExpoModulesCore
import WatchConnectivity

// A tiny bridge to the App-Group UserDefaults shared with the Siri App Intents
// (plugins/withAppIntents), PLUS the WatchConnectivity link to the Apple Watch
// app (targets/watch). App Groups do NOT reach a separate device, so the watch
// gets its data over WCSession: the app pushes the latest snapshot as the
// application context, and the watch sends back actions (add expense / change
// budget) via transferUserInfo, surfaced to JS as `onWatchAction`.
public class CentryNativeModule: Module {
  private let suiteName = "group.by.vazon.centry"

  public func definition() -> ModuleDefinition {
    Name("CentryNative")
    Events("onWatchAction")

    OnCreate {
      WatchBridge.shared.onAction = { [weak self] payload in
        self?.sendEvent("onWatchAction", ["payload": payload])
      }
      WatchBridge.shared.activate()
    }

    // --- App-Group UserDefaults (Siri / interactive widget) ---
    Function("getItem") { (key: String) -> String? in
      UserDefaults(suiteName: self.suiteName)?.string(forKey: key)
    }

    Function("setItem") { (key: String, value: String) in
      UserDefaults(suiteName: self.suiteName)?.set(value, forKey: key)
    }

    Function("removeItem") { (key: String) in
      UserDefaults(suiteName: self.suiteName)?.removeObject(forKey: key)
    }

    // --- Apple Watch (WatchConnectivity) ---
    /// Pushes the latest watch payload (JSON string) to the paired watch.
    Function("sendWatchContext") { (payload: String) in
      WatchBridge.shared.send(payload: payload)
    }

    /// Whether a watch is paired (so JS can skip building the payload otherwise).
    Function("isWatchPaired") { () -> Bool in
      WatchBridge.shared.isPaired
    }
  }
}

/// Singleton WCSession delegate on the phone side. Lives beyond any module
/// instance so the session stays active and queued transfers survive.
final class WatchBridge: NSObject, WCSessionDelegate {
  static let shared = WatchBridge()

  /// Called with the raw action JSON when the watch sends one.
  var onAction: ((String) -> Void)?
  /// The most recent payload, re-sent once the session activates.
  private var latest: String?

  var isPaired: Bool {
    guard WCSession.isSupported() else { return false }
    return WCSession.default.isPaired
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func send(payload: String) {
    guard WCSession.isSupported() else { return }
    latest = payload
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    // updateApplicationContext delivers the LATEST state even when the watch is
    // not reachable (queued until it next launches) — right for a state mirror.
    try? session.updateApplicationContext(["payload": payload])
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    // Sync a freshly-activated session with the latest known payload.
    if activationState == .activated, let latest = latest {
      try? session.updateApplicationContext(["payload": latest])
    }
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
    if let action = userInfo["action"] as? String {
      onAction?(action)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // Reactivate to keep talking to a switched watch.
    WCSession.default.activate()
  }
}
