import AuthenticationServices
import Capacitor

/// Sign in with Apple: shows Apple's sheet and answers with the identity token (proof of who you are, for the Forge API)
/// and the authorization code (used on Delete account, to revoke Forge's access). Asks for no name or email.
/// Cancelling rejects with the code "CANCELED".
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)]

    private var pending: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.pending?.reject("Another sign-in started.")
            self.pending = call
            let controller = ASAuthorizationController(authorizationRequests: [ASAuthorizationAppleIDProvider().createRequest()])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        bridge?.webView?.window ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        let credential = authorization.credential as? ASAuthorizationAppleIDCredential
        if let token = credential?.identityToken.flatMap({ String(data: $0, encoding: .utf8) }),
           let code = credential?.authorizationCode.flatMap({ String(data: $0, encoding: .utf8) }) {
            pending?.resolve(["identityToken": token, "authorizationCode": code])
        } else {
            pending?.reject("Sign in with Apple didn't go through. Try again.")
        }
        pending = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if (error as? ASAuthorizationError)?.code == .canceled {
            pending?.reject("Sign-in was cancelled.", "CANCELED")
        } else {
            pending?.reject("Sign in with Apple didn't go through. Try again.", nil, error)
        }
        pending = nil
    }
}
