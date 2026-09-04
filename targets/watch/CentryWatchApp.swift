import SwiftUI

// Centry watchOS app. Multi-page: allowance (main) · accounts · history · stats.
// Data arrives from the phone over WatchConnectivity (WatchModel); actions (quick
// add, change budget) go back the same way.

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
    // Plain TabView pages (vertical crown paging on watchOS): main → accounts →
    // history → stats.
    TabView {
      MainPage()
      AccountsPage()
      HistoryPage()
      StatsPage()
    }
  }
}

/// Main page — the "можно сегодня" allowance, a reserve line, a budget button,
/// and a "+" in the toolbar for a quick expense.
struct MainPage: View {
  @EnvironmentObject var model: WatchModel
  @State private var showAdd = false
  @State private var showBudget = false

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

          HStack {
            Text(L.reserve).font(.system(size: 12)).foregroundStyle(WatchTheme.dim)
            Spacer()
            Text("\(WatchMoney.format(p.periodRemainingMinor)) \(p.currency)")
              .font(.system(size: 13, weight: .medium))
              .monospacedDigit()
          }

          Button {
            showBudget = true
          } label: {
            Label(L.budget, systemImage: "slider.horizontal.3")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .tint(WatchTheme.accent)
          .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
      }
      .navigationTitle("Centry")
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            showAdd = true
          } label: {
            Image(systemName: "plus")
          }
        }
      }
      .sheet(isPresented: $showAdd) { QuickAddView().environmentObject(model) }
      .sheet(isPresented: $showBudget) { BudgetView().environmentObject(model) }
    }
  }
}
