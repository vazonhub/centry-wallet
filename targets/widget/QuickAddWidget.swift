import SwiftUI
import WidgetKit

// A separate "quick add" home-screen widget: preset expense buttons. On iOS 17+
// each button enqueues the amount interactively (no app open); on iOS 16 it opens
// the input sheet pre-filled via the `centry://add?kind=expense&amount=…` link.
// Amounts are whole major units, applied to the default account's currency.

private let QUICK_PRESETS = [5, 10, 20]

@available(iOS 16.0, *)
private struct QuickAddBackground: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(Palette.canvas, for: .widget)
    } else {
      content.background(Palette.canvas)
    }
  }
}

@available(iOS 16.0, *)
private struct PresetButton: View {
  let amount: Int
  var body: some View {
    let label = Text("−\(amount)")
      .font(.system(size: 18, weight: .semibold, design: .rounded))
      .monospacedDigit()
      .foregroundStyle(Palette.ink)
      .frame(maxWidth: .infinity, minHeight: 40)
      .background(Palette.chip)
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

    if #available(iOS 17.0, *) {
      Button(intent: QuickAddExpenseIntent(amount: amount)) { label }
        .buttonStyle(.plain)
    } else {
      Link(destination: URL(string: "centry://add?kind=expense&amount=\(amount)")!) { label }
    }
  }
}

@available(iOS 16.0, *)
struct QuickAddWidgetView: View {
  let snapshot: CentrySnapshot
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(snapshot.allowanceTitle)
        .font(.system(size: 10, weight: .semibold))
        .tracking(0.8)
        .foregroundStyle(Palette.dim)
      Text("\(Money.format(snapshot.remainingTodayMinor)) \(snapshot.currency)")
        .font(.system(size: 20, weight: .bold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .foregroundStyle(Palette.heroColor(remainingMinor: snapshot.remainingTodayMinor))
      HStack(spacing: 8) {
        ForEach(QUICK_PRESETS, id: \.self) { PresetButton(amount: $0) }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(14)
    .modifier(QuickAddBackground())
  }
}

@available(iOS 16.0, *)
struct QuickAddWidget: Widget {
  let kind = "CentryQuickAdd"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      QuickAddWidgetView(snapshot: entry.snapshot)
    }
    .configurationDisplayName("Centry — быстрая трата")
    .description("Записать трату в один тап")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}
