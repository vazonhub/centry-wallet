import SwiftUI

// Centry watchOS app. Info-only, vertical-paged: allowance (main) · accounts ·
// history · stats. Data arrives from the phone over WatchConnectivity
// (WatchModel). Input is via Siri on the watch, so there are no quick-add /
// budget-edit controls here (QuickAddView/BudgetView are unused now).

@main
struct CentryWatchApp: App {
  @StateObject private var model = WatchModel()

  var body: some Scene {
    WindowGroup {
      RootView().environmentObject(model)
    }
  }
}

struct RootView: View {
  @EnvironmentObject var model: WatchModel

  var body: some View {
    // Vertical page paging (Digital Crown) on watchOS 10+; falls back to the
    // default horizontal paging on watchOS 9. Order: main → accounts → history →
    // stats.
    if #available(watchOS 10.0, *) {
      TabView { pages }.tabViewStyle(.verticalPage)
    } else {
      TabView { pages }
    }
  }

  @ViewBuilder private var pages: some View {
    MainPage()
    AccountsPage()
    HistoryPage()
    StatsPage()
  }
}

/// Main page — the "можно сегодня" allowance with today's spend, and the current
/// budget shown at the bottom. Info-only: input happens via Siri on the watch, so
/// there is no quick-add button and no budget editor here (budget is set on the
/// phone).
struct MainPage: View {
  @EnvironmentObject var model: WatchModel

  private var p: WatchPayload { model.payload }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 8) {
          Text(p.allowanceTitle)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(WatchTheme.dim)
          HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(WatchMoney.format(p.remainingTodayMinor))
              .font(.system(size: 30, weight: .bold, design: .rounded))
              .monospacedDigit()
              .minimumScaleFactor(0.5)
              .lineLimit(1)
              .foregroundStyle(WatchTheme.heroColor(remainingMinor: p.remainingTodayMinor))
            Text("/ \(WatchMoney.format(p.perDayMinor))")
              .font(.system(size: 12))
              .foregroundStyle(WatchTheme.dim)
          }
          Text("\(p.spentLabel) \(WatchMoney.format(p.todaySpentMinor)) \(p.currency)")
            .font(.system(size: 12))
            .foregroundStyle(WatchTheme.dim)

          Divider().padding(.vertical, 2)

          // Current budget for the active period (read-only; edited on the phone).
          Text(
            "\(L.budget): \(WatchMoney.format(p.budgetAmountMinor)) \(p.budgetCurrency) · \(p.periodLabel)"
          )
          .font(.system(size: 12))
          .foregroundStyle(WatchTheme.dim)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
      }
      .navigationTitle("Centry")
    }
  }
}
