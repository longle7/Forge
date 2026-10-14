// swift-tools-version: 5.9
import PackageDescription

// Capacitor's sync adds this to ios/App/CapApp-SPM by its npm name, camel-cased: ForgeAppleSignIn.
let package = Package(
    name: "ForgeAppleSignIn",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "ForgeAppleSignIn", targets: ["ForgeAppleSignIn"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "ForgeAppleSignIn",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/ForgeAppleSignIn")
    ]
)
