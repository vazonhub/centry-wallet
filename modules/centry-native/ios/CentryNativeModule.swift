import ExpoModulesCore

// A tiny bridge to the App-Group UserDefaults shared with the Siri App Intents
// (plugins/withAppIntents). The JS app writes a stats summary here for the
// "how much money / can spend / spent today" intents to read, and reads the
// pending prefill an "Add expense/income" intent left behind. UserDefaults is
// used (not MMKV) because a second MMKV consumer in the main target corrupts the
// heap (see docs/DECISIONS) — plain Foundation storage links nothing extra.
public class CentryNativeModule: Module {
  private let suiteName = "group.by.vazon.centry"

  public func definition() -> ModuleDefinition {
    Name("CentryNative")

    Function("getItem") { (key: String) -> String? in
      UserDefaults(suiteName: self.suiteName)?.string(forKey: key)
    }

    Function("setItem") { (key: String, value: String) in
      UserDefaults(suiteName: self.suiteName)?.set(value, forKey: key)
    }

    Function("removeItem") { (key: String) in
      UserDefaults(suiteName: self.suiteName)?.removeObject(forKey: key)
    }
  }
}
