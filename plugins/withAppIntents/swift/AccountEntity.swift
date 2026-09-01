import AppIntents

// The account the "Add expense/income" intents can target. The list is dynamic
// (per user), so it's an AppEntity backed by a query that reads the accounts the
// app writes to App-Group UserDefaults (key "accounts") after each data refresh.
// Picking an account here preselects it in the input sheet, which also fixes the
// currency (the account's currency drives the amount).

@available(iOS 16.0, *)
struct CentryAccountEntity: AppEntity {
  let id: String
  let name: String

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Account"
  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

  static var defaultQuery = CentryAccountQuery()
}

@available(iOS 16.0, *)
struct CentryAccountQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [CentryAccountEntity] {
    Self.all().filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [CentryAccountEntity] {
    Self.all()
  }

  static func all() -> [CentryAccountEntity] {
    guard let json = UserDefaults(suiteName: CentryStore.suite)?.string(forKey: "accounts"),
      let data = json.data(using: .utf8),
      let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
    else { return [] }
    return arr.compactMap { dict in
      guard let id = dict["id"] as? String, let name = dict["name"] as? String else { return nil }
      return CentryAccountEntity(id: id, name: name)
    }
  }
}
