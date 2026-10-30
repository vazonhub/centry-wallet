import SwiftUI
import WidgetKit

// Entry point for the Centry widget extension. One widget kind ("CentryWidget")
// serving both small and medium families — the app reloads it by calling
// reloadAllTimelines() after each mutation (expo-widgetkit-bridge).

@main
struct CentryWidgetBundle: WidgetBundle {
  // Both widgets are listed unconditionally. Do NOT wrap either in `if #available`
  // — inside a @WidgetBundleBuilder that emits `buildLimitedAvailability`, which
  // traps at launch (the extension then never appears in the widget gallery). The
  // whole extension floors at iOS 16 instead (see expo-target.config.js).
  var body: some Widget {
    CentryWidget()
    // Interactive quick-add widget: taps are interactive on iOS 17+, and
    // deep-link to the input sheet on iOS 16.
    QuickAddWidget()
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

  /// Home-screen families + lock-screen (accessory) families (extension floors
  /// at iOS 16, so accessory families are always available).
  static let families: [WidgetFamily] = [
    .systemSmall,
    .systemMedium,
    .accessoryRectangular,
    .accessoryCircular,
    .accessoryInline,
  ]
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
      AccessoryEntryView(family: family, snapshot: entry.snapshot)
    }
  }
}

/// Routes the accessory (lock-screen) families.
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
