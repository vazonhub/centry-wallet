import Foundation
// The extension-safe MMKV pod, added to the app target by plugins/withAppIntents
// (pod 'MMKVAppExtension', :modular_headers => true — same module the widget
// uses). The class is `MMKV`; only the module name differs.
import MMKVAppExtension

// Writes the "pending intent" prefill the app reads on next foreground
// (src/services/intents + src/hooks/usePendingIntent). This is the Swift→JS
// half of the single AddTransactionIntent bridge (docs/UX_SPEC.md#ядро-ввода):
// Siri parses the phrase, we drop a small JSON here, the app opens the input
// sheet pre-seeded. NO money math in Swift — the real write funnels through the
// TS controller when the user taps save.
//
// Path contract mirrors targets/widget/SnapshotStore.swift: initialize MMKV
// with `rootDir` = the App-Group container ROOT so the file lands next to the
// widget snapshot, and react-native-mmkv (id: 'centry.intent') reads it. A
// SEPARATE mmapID from the widget snapshot, opened MULTI_PROCESS on both sides,
// keeps the cross-process channel off the widget's file.
enum CentryIntentStore {
  static let appGroupId = "group.by.vazon.centry"
  static let mmapID = "centry.intent"
  static let pendingKey = "pending"

  private static var didInitialize = false

  private static func store() -> MMKV? {
    guard
      let container = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?.path
    else { return nil }

    if !didInitialize {
      MMKV.initialize(rootDir: container)
      didInitialize = true
    }
    return MMKV(mmapID: mmapID, mode: .multiProcess)
  }

  /// Serializes the parsed phrase and stores it for the app to consume once.
  static func setPending(kind: String, amount: Double?, note: String?) {
    var dict: [String: Any] = ["kind": kind]
    if let amount, amount > 0 {
      // Whole number when possible ("12"), else a decimal string the TS side
      // sanitizes to the account currency's precision.
      dict["amount"] = amount == amount.rounded() ? String(Int(amount)) : String(amount)
    }
    if let note, !note.trimmingCharacters(in: .whitespaces).isEmpty {
      dict["note"] = note
    }
    guard
      let data = try? JSONSerialization.data(withJSONObject: dict),
      let json = String(data: data, encoding: .utf8)
    else { return }
    store()?.set(json, forKey: pendingKey)
  }
}
