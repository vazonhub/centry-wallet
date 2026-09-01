Pod::Spec.new do |s|
  s.name           = 'CentryNative'
  s.version        = '1.0.0'
  s.summary        = 'App Group storage bridge for Centry'
  s.description    = 'Reads/writes App Group UserDefaults shared with the Siri App Intents.'
  s.author         = 'Centry'
  s.homepage       = 'https://github.com/vazonhub/centry-wallet'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
