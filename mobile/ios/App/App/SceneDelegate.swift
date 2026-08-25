import UIKit
import Capacitor

enum NativeThemePreference {
    private static let key = "CapacitorStorage.app-theme-v1"

    static var storedTheme: String {
        UserDefaults.standard.string(forKey: key) ?? "system"
    }

    static func interfaceStyle(for theme: String? = nil) -> UIUserInterfaceStyle {
        switch theme ?? storedTheme {
        case "light": return .light
        case "dark": return .dark
        default: return .unspecified
        }
    }

    static func backgroundColor(for style: UIUserInterfaceStyle) -> UIColor {
        switch style {
        case .light:
            return UIColor(red: 243 / 255, green: 244 / 255, blue: 246 / 255, alpha: 1)
        case .dark:
            return UIColor(red: 8 / 255, green: 10 / 255, blue: 13 / 255, alpha: 1)
        default:
            return UIColor { traits in
                traits.userInterfaceStyle == .dark
                    ? UIColor(red: 8 / 255, green: 10 / 255, blue: 13 / 255, alpha: 1)
                    : UIColor(red: 243 / 255, green: 244 / 255, blue: 246 / 255, alpha: 1)
            }
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        // 启动背景固定暗色，但界面模式从一开始就是用户的最终主题。
        // 否则“跟随系统”的浅色主页会先按暗色渲染，再在开屏结束时整页跳变。
        let interfaceStyle = NativeThemePreference.interfaceStyle()
        let startupBackground = NativeThemePreference.backgroundColor(for: .dark)
        let rootViewController = LiquidGlassBridgeViewController()
        rootViewController.overrideUserInterfaceStyle = interfaceStyle
        rootViewController.view.backgroundColor = startupBackground

        window = UIWindow(windowScene: windowScene)
        window?.overrideUserInterfaceStyle = interfaceStyle
        window?.backgroundColor = startupBackground
        window?.rootViewController = rootViewController
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
