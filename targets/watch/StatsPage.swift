import SwiftUI

/// Stats page — spent/income over the last 30 days, plus two mini bar charts:
/// one by day, one by transaction (dependency-free bars).
struct StatsPage: View {
  @EnvironmentObject var model: WatchModel
  private var p: WatchPayload { model.payload }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 10) {
          HStack(spacing: 8) {
            statBox(L.spent, WatchMoney.format(p.windowSpentMinor), WatchTheme.neg)
            statBox(L.income, WatchMoney.format(p.windowIncomeMinor), WatchTheme.pos)
          }

          Text(L.byDay).font(.system(size: 11, weight: .semibold)).foregroundStyle(WatchTheme.dim)
          MiniBars(values: p.statsByDay.map { $0.spentMinor }, color: WatchTheme.accent)

          Text(L.byTx).font(.system(size: 11, weight: .semibold)).foregroundStyle(WatchTheme.dim)
          MiniBars(values: p.statsByTx, color: WatchTheme.accent)

          Text(L.last30).font(.system(size: 10)).foregroundStyle(WatchTheme.dim)
        }
        .padding(.horizontal, 4)
      }
      .navigationTitle(L.stats)
    }
  }

  private func statBox(_ title: String, _ value: String, _ color: Color) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(title).font(.system(size: 10)).foregroundStyle(WatchTheme.dim)
      Text(value)
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .foregroundStyle(color)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(8)
    .background(WatchTheme.chip)
    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}

/// Dependency-free mini bar chart — bars scaled to the window max.
struct MiniBars: View {
  let values: [Int]
  let color: Color

  var body: some View {
    let maxV = max(values.max() ?? 1, 1)
    GeometryReader { geo in
      HStack(alignment: .bottom, spacing: 1) {
        if values.isEmpty {
          Rectangle().fill(Color.clear)
        } else {
          ForEach(Array(values.enumerated()), id: \.offset) { _, v in
            RoundedRectangle(cornerRadius: 1)
              .fill(color)
              .frame(height: max(1, geo.size.height * CGFloat(v) / CGFloat(maxV)))
              .frame(maxWidth: .infinity)
          }
        }
      }
    }
    .frame(height: 42)
  }
}
