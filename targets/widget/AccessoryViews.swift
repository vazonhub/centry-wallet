import SwiftUI
import WidgetKit

// Lock-screen (accessory) widgets, iOS 16+. They show the real remaining "можно
// сегодня" amount at a glance. The system renders these tinted/monochrome, so we
// avoid our palette here and use `.widgetAccentable()` + secondary styling.
// Tapping opens the input sheet via the same `centry://add` deep link.

/// iOS 17+ wants an explicit (here: clear) container background even for
/// accessory widgets; earlier versions render transparent by default.
private struct AccessoryBackground: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(.clear, for: .widget)
    } else {
      content
    }
  }
}

private extension View {
  func accessoryBackground() -> some View { modifier(AccessoryBackground()) }
}

/// Rectangular lock-screen widget — title, remaining amount, period-remaining.
@available(iOS 16.0, *)
struct AccessoryRectangularView: View {
  let snapshot: CentrySnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(snapshot.allowanceTitle)
        .font(.system(size: 11, weight: .semibold))
        .widgetAccentable()
        .lineLimit(1)
      Text("\(Money.format(snapshot.remainingTodayMinor)) \(snapshot.currency)")
        .font(.system(size: 18, weight: .bold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.7)
        .lineLimit(1)
      Text("\(snapshot.forPeriodLabel): \(Money.format(snapshot.periodRemainingMinor))")
        .font(.system(size: 11))
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessoryBackground()
    .widgetURL(URL(string: "centry://add"))
  }
}

/// Circular lock-screen widget — a capacity gauge of today's spend vs the daily
/// budget, with the remaining amount in the centre.
@available(iOS 16.0, *)
struct AccessoryCircularView: View {
  let snapshot: CentrySnapshot
  private var fraction: Double {
    guard snapshot.perDayMinor > 0 else { return snapshot.todaySpentMinor > 0 ? 1 : 0 }
    return min(1, max(0, Double(snapshot.todaySpentMinor) / Double(snapshot.perDayMinor)))
  }
  var body: some View {
    Gauge(value: fraction) {
      Text(snapshot.currency)
    } currentValueLabel: {
      Text(Money.format(snapshot.remainingTodayMinor))
        .monospacedDigit()
        .minimumScaleFactor(0.5)
        .lineLimit(1)
    }
    .gaugeStyle(.accessoryCircularCapacity)
    .accessoryBackground()
    .widgetURL(URL(string: "centry://add"))
  }
}

/// Inline lock-screen widget — one line above the clock.
@available(iOS 16.0, *)
struct AccessoryInlineView: View {
  let snapshot: CentrySnapshot
  var body: some View {
    Text("\(snapshot.allowanceTitle): \(Money.format(snapshot.remainingTodayMinor)) \(snapshot.currency)")
      .widgetURL(URL(string: "centry://add"))
  }
}
