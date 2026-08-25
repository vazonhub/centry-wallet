# CocoaPods for the widget extension. @bacons/apple-targets globs
# targets/**/pods.rb and evals each inside a `target '<folder>' do ... end`
# block, so DO NOT add a `target` block here.
#
# Use MMKVAppExtension (not the plain MMKV pod): app extensions compile with
# APPLICATION_EXTENSION_API_ONLY = YES, and plain MMKV references
# extension-unavailable UIApplication APIs and would fail to build.
#
# `:modular_headers => true` is REQUIRED: MMKVAppExtension is a static Obj-C++
# pod that ships no clang module map, and the app links pods WITHOUT
# `use_frameworks!`. Without a module, `import MMKVAppExtension` from Swift fails
# with "no such module". Modular headers makes CocoaPods synthesize the module;
# its public `MMKV.h` guards its only C++ (`namespace mmkv`) behind
# `#ifdef __cplusplus`, so Swift's clang importer sees a clean Obj-C interface.
pod 'MMKVAppExtension', :modular_headers => true
