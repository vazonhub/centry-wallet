import SwiftUI

/// Quick add — pick expense/income, dial an amount with the Digital Crown, save.
/// Sends the action to the phone (applied to the default account); the sheet
/// closes optimistically (the phone pushes the updated payload back).
struct QuickAddView: View {
  @EnvironmentObject var model: WatchModel
  @Environment(\.dismiss) private var dismiss

  @State private var amount: Double = 10
  @State private var isIncome = false
  @FocusState private var crownFocused: Bool

  var body: some View {
    VStack(spacing: 8) {
      HStack(spacing: 6) {
        kindButton(L.addExpense, selected: !isIncome) { isIncome = false }
        kindButton(L.addIncome, selected: isIncome) { isIncome = true }
      }

      Text("\(Int(amount)) \(model.payload.currency)")
        .font(.system(size: 30, weight: .bold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.5)
        .lineLimit(1)
        .foregroundStyle(isIncome ? WatchTheme.pos : WatchTheme.ink)
        .focusable(true)
        .focused($crownFocused)
        .digitalCrownRotation(
          $amount, from: 0, through: 1_000_000, by: 1, sensitivity: .medium,
          isContinuous: false, isHapticFeedbackEnabled: true)

      HStack(spacing: 8) {
        Button(L.cancel) { dismiss() }
          .buttonStyle(.bordered)
        Button(L.save) {
          let value = Int(amount)
          if value > 0 {
            if isIncome { model.addIncome(amountMajor: value) } else {
              model.addExpense(amountMajor: value)
            }
          }
          dismiss()
        }
        .buttonStyle(.borderedProminent)
        .tint(WatchTheme.accent)
      }
    }
    .padding(.horizontal, 6)
    .onAppear { crownFocused = true }
  }

  private func kindButton(_ title: String, selected: Bool, action: @escaping () -> Void)
    -> some View
  {
    Button(action: action) {
      Text(title)
        .font(.system(size: 13, weight: .semibold))
        .frame(maxWidth: .infinity)
        .foregroundStyle(selected ? Color.black : WatchTheme.ink)
    }
    .buttonStyle(.borderedProminent)
    .tint(selected ? WatchTheme.accent : WatchTheme.chip)
  }
}
