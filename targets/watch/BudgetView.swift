import SwiftUI

/// Budget editor — dial the period budget amount with the Digital Crown and save.
/// Sends `setBudget` to the phone (applied to the current plan's currency).
struct BudgetView: View {
  @EnvironmentObject var model: WatchModel
  @Environment(\.dismiss) private var dismiss

  @State private var amount: Double = 0
  @FocusState private var crownFocused: Bool

  var body: some View {
    VStack(spacing: 10) {
      Text(L.newBudget)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(WatchTheme.dim)

      Text("\(Int(amount)) \(model.payload.budgetCurrency)")
        .font(.system(size: 30, weight: .bold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.5)
        .lineLimit(1)
        .foregroundStyle(WatchTheme.ink)
        .focusable(true)
        .focused($crownFocused)
        .digitalCrownRotation(
          $amount, from: 0, through: 10_000_000, by: 10, sensitivity: .low,
          isContinuous: false, isHapticFeedbackEnabled: true)

      HStack(spacing: 8) {
        Button(L.cancel) { dismiss() }
          .buttonStyle(.bordered)
        Button(L.save) {
          model.setBudget(amountMajor: Int(amount))
          dismiss()
        }
        .buttonStyle(.borderedProminent)
        .tint(WatchTheme.accent)
      }
    }
    .padding(.horizontal, 6)
    .onAppear {
      // Seed the dial with the current budget (major units; 2-decimal assumption).
      amount = Double(model.payload.budgetAmountMinor / 100)
      crownFocused = true
    }
  }
}
