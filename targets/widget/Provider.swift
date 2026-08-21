import WidgetKit

// Timeline provider. Reads the frozen snapshot from the App Group and emits a
// single entry. Data mutations in the app call `reloadAllTimelines()` (via
// expo-widgetkit-bridge), so we don't poll; we only schedule a reload at the
// next local midnight so "daysLeft" ticks over even if the app never opens.

struct SnapshotEntry: TimelineEntry {
  let date: Date
  let snapshot: CentrySnapshot
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> SnapshotEntry {
    SnapshotEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
    completion(SnapshotEntry(date: Date(), snapshot: SnapshotStore.load() ?? .placeholder))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
    let entry = SnapshotEntry(date: Date(), snapshot: SnapshotStore.load() ?? .placeholder)
    let nextMidnight = Calendar.current.nextDate(
      after: Date(),
      matching: DateComponents(hour: 0, minute: 0, second: 0),
      matchingPolicy: .nextTime
    ) ?? Date().addingTimeInterval(3600)
    completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
  }
}
