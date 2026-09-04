import SwiftUI
import WidgetKit

// Entry point for the Centry widget extension. One widget kind ("CentryWidget")
// serving both small and medium families — the app reloads it by calling
// reloadAllTimelines() after each mutation (expo-widgetkit-bridge).

@main
struct CentryWidgetBundle: WidgetBundle {
  var body: some Widget {
    CentryWidget()
    // Interactive quick-add widget (buttons need iOS 16 SDK; taps are interactive
    // on iOS 17+, and deep-link to the input sheet on iOS 16).
    if #available(iOS 16.0, *) {
      QuickAddWidget()
    }
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
    .supportedFamilies(Self.families)
    // Drop the ~16pt system content margins so our own tighter padding controls
    // the layout (more room for content in the small widget).
    .contentMarginsDisabled()
  }

  /// Home-screen families always; lock-screen (accessory) families on iOS 16+.
  static var families: [WidgetFamily] {
    var f: [WidgetFamily] = [.systemSmall, .systemMedium]
    if #available(iOS 16.0, *) {
      f.append(contentsOf: [.accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
    return f
  }
}

struct CentryWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: SnapshotEntry

  var body: some View {
    switch family {
    case .systemMedium:
      MediumWidgetView(snapshot: entry.snapshot)
    case .systemSmall:
      SmallWidgetView(snapshot: entry.snapshot)
    default:
      if #available(iOS 16.0, *) {
        AccessoryEntryView(family: family, snapshot: entry.snapshot)
      } else {
        SmallWidgetView(snapshot: entry.snapshot)
      }
    }
  }
}

/// Routes the accessory (lock-screen) families. Split out so the iOS 16 enum
/// cases are only referenced inside an availability-guarded view.
@available(iOS 16.0, *)
private struct AccessoryEntryView: View {
  let family: WidgetFamily
  let snapshot: CentrySnapshot

  var body: some View {
    switch family {
    case .accessoryRectangular:
      AccessoryRectangularView(snapshot: snapshot)
    case .accessoryCircular:
      AccessoryCircularView(snapshot: snapshot)
    case .accessoryInline:
      AccessoryInlineView(snapshot: snapshot)
    default:
      SmallWidgetView(snapshot: snapshot)
    }
  }
}
