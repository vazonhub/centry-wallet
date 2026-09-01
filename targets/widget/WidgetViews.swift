import SwiftUI
import WidgetKit

// SwiftUI for the Centry widgets. S = "можно сегодня"; M adds today-spent and
// the three latest entries (docs/UX_SPEC.md#ядро-ввода). Tapping opens the
// input sheet via the `centry://add` deep link.

/// iOS 17+ requires an explicit container background; earlier versions paint it
/// themselves. This keeps one call-site for both.
private struct WidgetBackground: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(Palette.canvas, for: .widget)
    } else {
      content.background(Palette.canvas)
    }
  }
}

private extension View {
  func widgetBackground() -> some View { modifier(WidgetBackground()) }
}

/// The hero — label + "можно сегодня" number, tinted by daily-limit usage.
private struct HeroBlock: View {
  let snapshot: CentrySnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(snapshot.allowanceTitle)
        .font(.system(size: 10, weight: .semibold))
        .tracking(0.8)
        .foregroundStyle(Palette.dim)
      Text(Money.format(snapshot.perDayMinor))
        .font(.system(size: 30, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .foregroundStyle(
          Palette.heroColor(perDayMinor: snapshot.perDayMinor,
                            todaySpentMinor: snapshot.todaySpentMinor)
        )
      Text("\(snapshot.spentLabel) \(Money.format(snapshot.todaySpentMinor)) \(snapshot.currency)")
        .font(.system(size: 11))
        .foregroundStyle(Palette.dim)
        .lineLimit(1)
    }
  }
}

/// One line of the recent feed — category · amount (no icon).
private struct RecentRow: View {
  let item: WidgetRecent
  var body: some View {
    HStack(spacing: 6) {
      Text(item.note)
        .font(.system(size: 12))
        .foregroundStyle(Palette.ink)
        .lineLimit(1)
      Spacer(minLength: 4)
      Text(Money.format(item.amountMinor, showPlus: item.amountMinor >= 0))
        .font(.system(size: 12, weight: .medium))
        .monospacedDigit()
        .foregroundStyle(item.amountMinor >= 0 ? Palette.pos : Palette.ink)
        .lineLimit(1)
    }
  }
}

/// Bottom caption: how much is still spendable for the whole period.
private struct PeriodRemaining: View {
  let snapshot: CentrySnapshot
  var body: some View {
    Text("\(snapshot.forPeriodLabel): \(Money.format(snapshot.periodRemainingMinor)) \(snapshot.currency)")
      .font(.system(size: 10))
      .foregroundStyle(Palette.dim)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
  }
}

struct SmallWidgetView: View {
  let snapshot: CentrySnapshot
  var body: some View {
    // Content grouped and vertically centered, with a breathing gap between the
    // hero ("потрачено за сегодня") and the period-remaining caption.
    VStack(alignment: .leading, spacing: 16) {
      HeroBlock(snapshot: snapshot)
      PeriodRemaining(snapshot: snapshot)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(16)
    .widgetBackground()
    .widgetURL(URL(string: "centry://add"))
  }
}

struct MediumWidgetView: View {
  let snapshot: CentrySnapshot
  var body: some View {
    HStack(alignment: .center, spacing: 16) {
      // Left: hero + period-remaining, grouped with a breathing gap between them.
      VStack(alignment: .leading, spacing: 16) {
        HeroBlock(snapshot: snapshot)
        PeriodRemaining(snapshot: snapshot)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      // Right: recent entries, vertically centered with a little extra inset.
      // Tight spacing so up to WIDGET_RECENT_LIMIT (6) rows fit the medium size.
      VStack(alignment: .leading, spacing: 4) {
        if snapshot.recent.isEmpty {
          Text(snapshot.emptyLabel)
            .font(.system(size: 12))
            .foregroundStyle(Palette.dim)
        } else {
          ForEach(snapshot.recent, id: \.self) { RecentRow(item: $0) }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.leading, 4)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    .padding(16)
    .widgetBackground()
    .widgetURL(URL(string: "centry://add"))
  }
}
