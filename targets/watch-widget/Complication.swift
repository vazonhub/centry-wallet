import SwiftUI
import WidgetKit

// Centry watch-face complications: the remaining "можно сегодня" amount + today's
// spend, across the accessory families. The watch app writes the payload to the
// shared App Group and calls reloadAllTimelines(); the timeline policy is .never
// so the app drives refreshes.

struct ComplicationEntry: TimelineEntry {
  let date: Date
  let snapshot: MiniSnapshot
}

struct ComplicationProvider: TimelineProvider {
  func placeholder(in context: Context) -> ComplicationEntry {
    ComplicationEntry(date: Date(), snapshot: .placeholder)
  }
  func getSnapshot(in context: Context, completion: @escaping (ComplicationEntry) -> Void) {
    completion(ComplicationEntry(date: Date(), snapshot: .load()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<ComplicationEntry>) -> Void)
  {
    let entry = ComplicationEntry(date: Date(), snapshot: .load())
    completion(Timeline(entries: [entry], policy: .never))
  }
}

/// watchOS 10+ wants an explicit (clear) container background on accessory widgets.
private struct AccessoryBG: ViewModifier {
  func body(content: Content) -> some View {
    if #available(watchOS 10.0, *) {
      content.containerBackground(.clear, for: .widget)
    } else {
      content
    }
  }
}

struct ComplicationView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ComplicationEntry

  var body: some View {
    let s = entry.snapshot
    switch family {
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 1) {
        Text(s.allowanceTitle).font(.system(size: 11, weight: .semibold)).widgetAccentable()
          .lineLimit(1)
        Text("\(CMoney.format(s.remainingTodayMinor)) \(s.currency)")
          .font(.system(size: 17, weight: .bold, design: .rounded)).minimumScaleFactor(0.7)
          .lineLimit(1)
        Text("\(s.spentLabel) \(CMoney.format(s.todaySpentMinor))")
          .font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .modifier(AccessoryBG())
    case .accessoryInline:
      Text("\(CMoney.format(s.remainingTodayMinor)) \(s.currency)")
    case .accessoryCorner:
      Text(CMoney.format(s.remainingTodayMinor))
        .font(.system(size: 15, weight: .bold, design: .rounded)).minimumScaleFactor(0.6)
        .modifier(AccessoryBG())
    default:  // accessoryCircular
      VStack(spacing: 0) {
        Text(CMoney.format(s.remainingTodayMinor))
          .font(.system(size: 15, weight: .bold, design: .rounded))
          .monospacedDigit().minimumScaleFactor(0.4).lineLimit(1)
        Text(s.currency).font(.system(size: 9)).foregroundStyle(.secondary)
      }
      .modifier(AccessoryBG())
    }
  }
}

@main
struct CentryComplicationBundle: WidgetBundle {
  var body: some Widget {
    CentryComplication()
  }
}

struct CentryComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "CentryComplication", provider: ComplicationProvider()) { entry in
      ComplicationView(entry: entry)
    }
    .configurationDisplayName("Centry")
    .description("Сколько можно потратить сегодня")
    .supportedFamilies([
      .accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner,
    ])
  }
}
