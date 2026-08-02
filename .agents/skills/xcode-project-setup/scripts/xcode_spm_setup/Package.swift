// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "xcode_spm_setup",
    platforms: [.macOS(.v13)],
    dependencies: [
        // Pinned to 8.24.11 (swift-tools-version 5.8): 8.24.12+ requires swift-tools-version
        // 5.10, which is newer than the Swift 5.9.2 toolchain shipped with Xcode 15.1.
        .package(url: "https://github.com/tuist/XcodeProj.git", .exact("8.24.11")),
    ],
    targets: [
        .executableTarget(
            name: "xcode_spm_setup",
            dependencies: ["XcodeProj"],
            path: "Sources"
        )
    ]
)
