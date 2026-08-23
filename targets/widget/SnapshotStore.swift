import Foundation
// The extension-safe MMKV pod (see targets/widget/pods.rb), imported as the
// module `MMKVAppExtension` (the class is still `MMKV`). The pod ships no module
// map, so pods.rb pins it with `:modular_headers => true` to make this import
// resolve — without that, the build fails with "no such module".
import MMKVAppExtension

// Reads the widget snapshot the app writes to the shared App-Group MMKV.
//
// Path contract with react-native-mmkv 3.3.3 (verified against its native
// source): when `AppGroup` is set in the app's Info.plist and the JS instance
// is created as `new MMKV({ id: 'centry.widget' })` with NO explicit `path`,
// the file lands at `<AppGroupContainerRoot>/centry.widget` — the container
// ROOT, NOT a `/mmkv` subfolder. So we initialize MMKV with `rootDir:` = the
// container root (NOT the `initialize(rootDir:groupDir:)` convenience, which
// would resolve to `<container>/mmkv/` and miss the data).

enum SnapshotStore {
  static let appGroupId = "group.by.vazon.centry"
  static let mmapID = "centry.widget"
  static let snapshotKey = "snapshot"

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
    // Multi-process mode is REQUIRED here: the app (a separate process) is the
    // writer and this widget-extension process is a long-lived reader. In
    // single-process mode MMKV keeps its in-memory copy from the first open and
    // never re-reads the app's later writes, so the widget renders the all-zero
    // placeholder forever. `.multiProcess` uses an inter-process file lock and
    // re-checks the file on open, so each timeline reload sees fresh data.
    // No `path:` argument → uses the rootDir set above → <container>/centry.widget.
    return MMKV(mmapID: mmapID, mode: .multiProcess)
  }

  /// Loads and decodes the latest snapshot, or nil if none has been written yet.
  static func load() -> CentrySnapshot? {
    guard let json = store()?.string(forKey: snapshotKey) else { return nil }
    return CentrySnapshot.decode(from: json)
  }
}
