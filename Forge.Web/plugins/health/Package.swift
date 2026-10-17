// swift-tools-version: 5.9
import PackageDescription

// Capacitor's sync adds this to ios/App/CapApp-SPM by its npm name, camel-cased: ForgeHealth.
let package = Package(
    name: "ForgeHealth",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "ForgeHealth", targets: ["ForgeHealth"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "ForgeHealth",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/ForgeHealth")
    ]
)
