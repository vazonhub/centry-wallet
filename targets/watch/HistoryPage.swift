import SwiftUI

/// History page — the recent transactions (note + amount). Read-only.
struct HistoryPage: View {
  @EnvironmentObject var model: WatchModel
  private var recent: [WatchRecent] { model.payload.recent }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 4) {
          if recent.isEmpty {
            Text(L.noRecords)
              .font(.system(size: 13))
              .foregroundStyle(WatchTheme.dim)
              .padding(.top, 12)
          } else {
            ForEach(recent) { item in
              HStack {
                Text(item.note)
                  .font(.system(size: 13))
                  .foregroundStyle(WatchTheme.ink)
                  .lineLimit(1)
                Spacer(minLength: 6)
                Text(amountText(item))
                  .font(.system(size: 13, weight: .medium))
                  .monospacedDigit()
                  .foregroundStyle(color(item))
                  .lineLimit(1)
              }
              .padding(.horizontal, 8)
              .padding(.vertical, 6)
            }
          }
        }
        .padding(.horizontal, 4)
      }
      .navigationTitle(L.history)
    }
  }

  private func amountText(_ item: WatchRecent) -> String {
    "\(WatchMoney.format(item.amountMinor, showPlus: item.isIncome)) \(item.currency)"
  }

  private func color(_ item: WatchRecent) -> Color {
    if item.isTransfer { return WatchTheme.dim }
    return item.isIncome ? WatchTheme.pos : WatchTheme.ink
  }
}
