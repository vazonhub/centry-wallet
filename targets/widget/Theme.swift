import SwiftUI
import UIKit

// Widget palette — the Centry Liquid Glass tokens (docs/DESIGN_SYSTEM.md),
// resolved per light/dark automatically via a dynamic UIColor. Colour means
// exactly one thing (rule 6): green = приход/профицит, red = перерасход.

private extension Color {
  /// Dynamic colour that switches on the widget's light/dark appearance.
  static func dynamic(light: UInt32, dark: UInt32) -> Color {
    Color(UIColor { traits in
      UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
    })
  }
}

private extension UIColor {
  convenience init(rgb: UInt32) {
    self.init(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1
    )
  }
}

enum Palette {
  static let canvas = Color.dynamic(light: 0xeef0f5, dark: 0x0d0f13)
  static let ink = Color.dynamic(light: 0x14161b, dark: 0xeef1f6)
  static let dim = Color.dynamic(light: 0x6b7280, dark: 0x98a0ad)
  static let pos = Color.dynamic(light: 0x0f7a4f, dark: 0x4ade80)
  static let neg = Color.dynamic(light: 0xb42318, dark: 0xff6b60)
  static let warn = Color.dynamic(light: 0xa35a00, dark: 0xfbbf5a)

  /// Hero colour by daily-limit usage (B9): 0–80% green, 80–99% warn, ≥100% red.
  static func heroColor(perDayMinor: Int, todaySpentMinor: Int) -> Color {
    let usage: Double
    if perDayMinor > 0 {
      usage = Double(todaySpentMinor) / Double(perDayMinor)
    } else {
      usage = todaySpentMinor > 0 ? 1 : 0
    }
    if usage < 0.8 { return pos }
    if usage < 1 { return warn }
    return neg
  }
}
