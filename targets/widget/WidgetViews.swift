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
      Text("МОЖНО СЕГОДНЯ")
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
      Text("потрачено \(Money.format(snapshot.todaySpentMinor)) \(snapshot.currency)")
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
      Text(item.note.isEmpty ? "Без категории" : item.note)
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
    Text("на \(snapshot.periodLabel): \(Money.format(snapshot.periodRemainingMinor)) \(snapshot.currency)")
      .font(.system(size: 10))
      .foregroundStyle(Palette.dim)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
  }
}

struct SmallWidgetView: View {
  let snapshot: CentrySnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HeroBlock(snapshot: snapshot)
      Spacer(minLength: 0)
      PeriodRemaining(snapshot: snapshot)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(12)
    .widgetBackground()
    .widgetURL(URL(string: "centry://add"))
  }
}

struct MediumWidgetView: View {
  let snapshot: CentrySnapshot
  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 6) {
        HeroBlock(snapshot: snapshot)
        Spacer(minLength: 0)
        PeriodRemaining(snapshot: snapshot)
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      VStack(alignment: .leading, spacing: 6) {
        if snapshot.recent.isEmpty {
          Text("Нет записей")
            .font(.system(size: 12))
            .foregroundStyle(Palette.dim)
        } else {
          ForEach(snapshot.recent, id: \.self) { RecentRow(item: $0) }
        }
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .padding(12)
    .widgetBackground()
    .widgetURL(URL(string: "centry://add"))
  }
}
