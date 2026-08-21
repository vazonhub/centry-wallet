import SwiftUI
import WidgetKit

// Entry point for the Centry widget extension. One widget kind ("CentryWidget")
// serving both small and medium families — the app reloads it by calling
// reloadAllTimelines() after each mutation (expo-widgetkit-bridge).

@main
struct CentryWidgetBundle: WidgetBundle {
  var body: some Widget {
    CentryWidget()
  }
}

struct CentryWidget: Widget {
  let kind = "CentryWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      CentryWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Centry")
    .description("Сколько можно потратить сегодня")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct CentryWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: SnapshotEntry

  var body: some View {
    switch family {
    case .systemMedium:
      MediumWidgetView(snapshot: entry.snapshot)
    default:
      SmallWidgetView(snapshot: entry.snapshot)
    }
  }
}
