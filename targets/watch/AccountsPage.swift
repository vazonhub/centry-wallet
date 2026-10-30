import SwiftUI

/// Accounts page — the spend accounts with balances (same data as the phone's
/// chips). Read-only on the watch.
struct AccountsPage: View {
  @EnvironmentObject var model: WatchModel
  private var accounts: [WatchAccount] { model.payload.accounts }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 6) {
          if accounts.isEmpty {
            Text(L.noRecords)
              .font(.system(size: 13))
              .foregroundStyle(WatchTheme.dim)
              .padding(.top, 12)
          } else {
            ForEach(accounts) { account in
              HStack {
                Text(account.name)
                  .font(.system(size: 14))
                  .foregroundStyle(WatchTheme.ink)
                  .lineLimit(1)
                Spacer(minLength: 6)
                Text("\(WatchMoney.format(account.balanceMinor)) \(account.currency)")
                  .font(.system(size: 13, weight: .medium))
                  .monospacedDigit()
                  .foregroundStyle(account.balanceMinor < 0 ? WatchTheme.neg : WatchTheme.ink)
                  .lineLimit(1)
              }
              .padding(.horizontal, 10)
              .padding(.vertical, 8)
              .background(WatchTheme.chip)
              .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
          }
        }
        .padding(.horizontal, 4)
      }
      .navigationTitle(L.accounts)
    }
  }
}
