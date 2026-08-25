import UIKit
import WebKit
import Capacitor

/// iOS 26 使用系统 UITabBarController 托管底部菜单，获得与 Apple Music 一致的 Liquid Glass 交互。
final class LiquidGlassBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler, UITabBarControllerDelegate {
    private enum Tab: String, CaseIterable {
        case search
        case records
        case settings

        var title: String {
            switch self {
            case .search: return "查询"
            case .records: return "记录"
            case .settings: return "设置"
            }
        }

        var symbolName: String {
            switch self {
            case .search: return "magnifyingglass"
            case .records: return "book.pages"
            case .settings: return "gearshape"
            }
        }
    }

    private let messageHandlerName = "liquidGlassNavigation"
    private let accentColor = UIColor(red: 233 / 255, green: 92 / 255, blue: 59 / 255, alpha: 1)
    private let selectedBackgroundColor = UIColor(red: 214 / 255, green: 214 / 255, blue: 214 / 255, alpha: 1)
    private var nativeTabController: UITabBarController?
    private var historyButton: UIButton?
    private var clearRecordsButton: UIButton?
    private var clearHistoryButton: UIButton?
    private var backButton: UIButton?
    private var nativeTabBottomConstraint: NSLayoutConstraint?
    private var currentPath = "/tabs/search"
    private var webOverlayVisible = false
    private var webStartupReady = false
    private var pendingTheme = NativeThemePreference.storedTheme
    private var startupCoverView: UIView?
    private weak var nativeToastView: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()

        configureWebBridge()

        // WKWebView 创建 HTML 画布前会短暂显示自身背景，这一层也必须固定为暗色。
        let startupBackground = NativeThemePreference.backgroundColor(for: .dark)
        view.backgroundColor = startupBackground
        webView?.backgroundColor = startupBackground
        webView?.scrollView.backgroundColor = startupBackground

        if #available(iOS 26.0, *) {
            configureNativeTabBar()
            configureNativeHeaderButtons()
            observeKeyboardFrameChanges()
            updateRoute("/tabs/search")
        }

        // 承接系统 LaunchScreen，避免它结束后 Logo 消失，再由 Web 开屏重新出现。
        configureStartupCover()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func configureWebBridge() {
        let userContentController = webView?.configuration.userContentController
        userContentController?.add(self, name: messageHandlerName)

        let source = """
        document.documentElement.classList.add('ios-native-liquid-glass');
        window.__iosNativeLiquidGlass = true;
        window.dispatchEvent(new CustomEvent('ios-liquid-glass-ready'));
        """
        userContentController?.addUserScript(
            WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        )
        webView?.evaluateJavaScript(source)
    }

    private func configureStartupCover() {
        let cover = UIView()
        cover.translatesAutoresizingMaskIntoConstraints = false
        cover.backgroundColor = NativeThemePreference.backgroundColor(for: .dark)
        cover.isUserInteractionEnabled = true

        let logo = UIImageView(image: UIImage(named: "Splash"))
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.contentMode = .scaleAspectFit
        cover.addSubview(logo)

        view.addSubview(cover)
        NSLayoutConstraint.activate([
            cover.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            cover.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            cover.topAnchor.constraint(equalTo: view.topAnchor),
            cover.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            logo.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
            logo.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
            logo.widthAnchor.constraint(equalToConstant: 168),
            logo.heightAnchor.constraint(equalToConstant: 168)
        ])
        startupCoverView = cover
    }

    private func revealStartupContent() {
        // 原生菜单和最终背景先在开屏承接层下准备好，淡出时直接展示完整主页。
        webStartupReady = true
        updateTheme(pendingTheme, updateSurfaces: true)
        if #available(iOS 26.0, *) {
            updateNativeControlVisibility()
        }

        guard let cover = startupCoverView else {
            completeStartupTransition()
            return
        }

        UIView.animate(
            withDuration: 0.3,
            delay: 0,
            options: [.beginFromCurrentState, .curveEaseOut, .allowUserInteraction]
        ) {
            cover.alpha = 0
        } completion: { [weak self] _ in
            cover.removeFromSuperview()
            self?.startupCoverView = nil
            self?.completeStartupTransition()
        }
    }

    private func completeStartupTransition() {
        setNeedsStatusBarAppearanceUpdate()
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new Event('native-startup-transition-complete'))"
        )
    }

    @available(iOS 26.0, *)
    private func configureNativeTabBar() {
        let tabController = UITabBarController()
        tabController.delegate = self
        tabController.view.translatesAutoresizingMaskIntoConstraints = false
        tabController.view.backgroundColor = .clear
        tabController.view.isOpaque = false

        let symbolConfiguration = UIImage.SymbolConfiguration(pointSize: 16, weight: .medium)
        let controllers = Tab.allCases.enumerated().map { index, tab in
            let controller = UIViewController()
            controller.view.backgroundColor = .clear
            controller.view.isOpaque = false
            controller.tabBarItem = UITabBarItem(
                title: tab.title,
                image: UIImage(systemName: tab.symbolName, withConfiguration: symbolConfiguration),
                tag: index
            )
            return controller
        }
        tabController.setViewControllers(controllers, animated: false)
        tabController.selectedIndex = 0

        let tabBar = tabController.tabBar
        tabBar.itemPositioning = .fill
        tabBar.isTranslucent = true
        tabBar.clipsToBounds = false
        tabBar.cornerConfiguration = .capsule()
        tabBar.tintColor = accentColor
        tabBar.unselectedItemTintColor = .secondaryLabel

        // 只配置颜色与字体。图文布局、按压透明化、玻璃透镜和移动
        // 全部交给 iOS 26 的 UITabBarController，避免手工模拟官方交互。
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        appearance.selectionIndicatorTintColor = selectedBackgroundColor
        appearance.stackedItemPositioning = .fill
        configureItemAppearance(appearance.stackedLayoutAppearance)
        configureItemAppearance(appearance.inlineLayoutAppearance)
        configureItemAppearance(appearance.compactInlineLayoutAppearance)
        tabBar.standardAppearance = appearance
        tabBar.scrollEdgeAppearance = appearance

        addChild(tabController)
        view.addSubview(tabController.view)
        tabController.didMove(toParent: self)
        nativeTabController = tabController

        let bottomConstraint = tabController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        nativeTabBottomConstraint = bottomConstraint
        NSLayoutConstraint.activate([
            tabController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomConstraint,
            tabController.view.heightAnchor.constraint(equalToConstant: 104)
        ])
    }

    @available(iOS 26.0, *)
    private func observeKeyboardFrameChanges() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardFrameWillChange(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardFrameWillChange(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
    }

    /// 原生菜单和 WebView 是兄弟视图，键盘只会自动调整 WebView。
    /// 因此根据键盘与根视图的实际交叠高度移动菜单，并保留一段操作间距。
    @objc private func keyboardFrameWillChange(_ notification: Notification) {
        guard #available(iOS 26.0, *),
              let nativeTabBottomConstraint,
              let endFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return
        }

        let keyboardFrame = view.convert(endFrame, from: nil)
        let overlap = max(0, view.bounds.maxY - keyboardFrame.minY)
        // 键盘出现后 Home Indicator 已属于键盘区域；抵消根视图原有的底部安全区，
        // 再额外上移 10pt，避免菜单与键盘边缘完全贴合。
        let obsoleteSafeArea = overlap > 0 ? view.safeAreaInsets.bottom : 0
        let keyboardGap: CGFloat = overlap > 0 ? 10 : 0
        nativeTabBottomConstraint.constant = -overlap + obsoleteSafeArea - keyboardGap

        let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        let rawCurve = notification.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? 7
        let options = UIView.AnimationOptions(rawValue: rawCurve << 16)

        UIView.animate(
            withDuration: duration,
            delay: 0,
            options: [options, .beginFromCurrentState, .allowUserInteraction]
        ) {
            self.view.layoutIfNeeded()
        }
    }

    @available(iOS 26.0, *)
    private func configureItemAppearance(_ appearance: UITabBarItemAppearance) {
        let normalAttributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: UIColor.secondaryLabel,
            .font: UIFont.systemFont(ofSize: 9.5, weight: .semibold)
        ]
        let selectedAttributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: accentColor,
            .font: UIFont.systemFont(ofSize: 9.5, weight: .semibold)
        ]

        appearance.normal.iconColor = .secondaryLabel
        appearance.normal.titleTextAttributes = normalAttributes
        appearance.selected.iconColor = accentColor
        appearance.selected.titleTextAttributes = selectedAttributes
    }

    @available(iOS 26.0, *)
    private func makeGlassIconButton(
        systemName: String,
        accessibilityLabel: String,
        action: Selector
    ) -> UIButton {
        var configuration = UIButton.Configuration.glass()
        configuration.image = UIImage(systemName: systemName)
        configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(
            pointSize: 17,
            weight: .medium
        )
        configuration.baseForegroundColor = .label

        let button = UIButton(configuration: configuration)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.accessibilityLabel = accessibilityLabel
        button.cornerConfiguration = .capsule()
        button.layer.zPosition = 100
        button.addTarget(self, action: action, for: .touchUpInside)
        view.addSubview(button)
        return button
    }

    @available(iOS 26.0, *)
    private func configureNativeHeaderButtons() {
        let historyButton = makeGlassIconButton(
            systemName: "clock.arrow.circlepath",
            accessibilityLabel: "查看历史记录",
            action: #selector(openHistory)
        )
        let clearRecordsButton = makeGlassIconButton(
            systemName: "trash",
            accessibilityLabel: "清空记录",
            action: #selector(requestClearRecords)
        )
        let clearHistoryButton = makeGlassIconButton(
            systemName: "trash",
            accessibilityLabel: "清空查询历史",
            action: #selector(requestClearHistory)
        )
        let backButton = makeGlassIconButton(
            systemName: "chevron.left",
            accessibilityLabel: "返回",
            action: #selector(goBack)
        )

        self.historyButton = historyButton
        self.clearRecordsButton = clearRecordsButton
        self.clearHistoryButton = clearHistoryButton
        self.backButton = backButton

        NSLayoutConstraint.activate([
            historyButton.widthAnchor.constraint(equalToConstant: 42),
            historyButton.heightAnchor.constraint(equalToConstant: 42),
            historyButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            historyButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 23),

            clearRecordsButton.widthAnchor.constraint(equalToConstant: 42),
            clearRecordsButton.heightAnchor.constraint(equalToConstant: 42),
            clearRecordsButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            clearRecordsButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 23),

            clearHistoryButton.widthAnchor.constraint(equalToConstant: 42),
            clearHistoryButton.heightAnchor.constraint(equalToConstant: 42),
            clearHistoryButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            clearHistoryButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 23),

            backButton.widthAnchor.constraint(equalToConstant: 42),
            backButton.heightAnchor.constraint(equalToConstant: 42),
            backButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            backButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 23)
        ])
    }

    func tabBarController(
        _ tabBarController: UITabBarController,
        didSelect viewController: UIViewController
    ) {
        guard #available(iOS 26.0, *),
              let tab = Tab.allCases[safe: viewController.tabBarItem.tag] else { return }

        dispatchWebEvent(
            name: "native-liquid-glass-tab",
            detail: ["tab": tab.rawValue]
        )
    }

    @objc private func openHistory() {
        guard #available(iOS 26.0, *) else { return }
        dispatchWebEvent(name: "native-liquid-glass-history")
    }

    @objc private func requestClearRecords() {
        guard #available(iOS 26.0, *) else { return }
        presentNativeConfirmation(
            action: "clear-records",
            title: "清空所有记录？",
            message: "摄入和热量校准记录将被永久删除。",
            confirmTitle: "清空"
        )
    }

    @objc private func requestClearHistory() {
        guard #available(iOS 26.0, *) else { return }
        presentNativeConfirmation(
            action: "clear-history",
            title: "清空查询历史？",
            message: "所有查询历史将被永久删除。",
            confirmTitle: "清空"
        )
    }

    @objc private func goBack() {
        guard #available(iOS 26.0, *) else { return }
        dispatchWebEvent(name: "native-liquid-glass-back")
    }

    @available(iOS 26.0, *)
    private func dispatchWebEvent(name: String, detail: [String: String]? = nil) {
        let detailExpression: String
        if let detail,
           let data = try? JSONSerialization.data(withJSONObject: detail),
           let json = String(data: data, encoding: .utf8) {
            detailExpression = json
        } else {
            detailExpression = "null"
        }

        let script = """
        window.dispatchEvent(new CustomEvent('\(name)', { detail: \(detailExpression) }));
        """
        webView?.evaluateJavaScript(script)
    }

    private func updateRoute(_ path: String) {
        guard #available(iOS 26.0, *) else { return }

        currentPath = path

        if let tab = path
            .split(separator: "/")
            .last
            .flatMap({ Tab(rawValue: String($0)) }),
           let index = Tab.allCases.firstIndex(of: tab) {
            nativeTabController?.selectedIndex = index
        }

        updateNativeControlVisibility()

        // Web 路由过渡会临时创建新的合成层；每次切页后重新确保原生控件位于最上层。
        [historyButton, clearRecordsButton, clearHistoryButton, backButton]
            .compactMap { $0 }
            .forEach { view.bringSubviewToFront($0) }
    }

    @available(iOS 26.0, *)
    private func updateNativeControlVisibility() {
        // 开屏期间原生控件位于 WKWebView 上层，必须由 Web 明确通知开屏结束后再显示。
        let nativeControlsHidden = !webStartupReady || webOverlayVisible
        nativeTabController?.view.isHidden = nativeControlsHidden || !currentPath.hasPrefix("/tabs/")
        historyButton?.isHidden = nativeControlsHidden || !currentPath.hasPrefix("/tabs/search")
        clearRecordsButton?.isHidden = nativeControlsHidden || !currentPath.hasPrefix("/tabs/records")
        clearHistoryButton?.isHidden = nativeControlsHidden || currentPath != "/history"
        backButton?.isHidden = nativeControlsHidden || currentPath.hasPrefix("/tabs/")
    }

    private func updateTheme(_ theme: String, updateSurfaces: Bool) {
        let interfaceStyle = NativeThemePreference.interfaceStyle(for: theme)
        overrideUserInterfaceStyle = interfaceStyle
        view.window?.overrideUserInterfaceStyle = interfaceStyle

        if updateSurfaces {
            let backgroundColor = NativeThemePreference.backgroundColor(for: interfaceStyle)
            view.backgroundColor = backgroundColor
            view.window?.backgroundColor = backgroundColor
            webView?.backgroundColor = backgroundColor
            webView?.scrollView.backgroundColor = backgroundColor
        }
        setNeedsStatusBarAppearanceUpdate()
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        // 原生主题可在交叉淡化前预加载，但暗色开屏消失前状态栏始终使用浅色图标。
        guard startupCoverView == nil else { return .lightContent }
        let style = overrideUserInterfaceStyle == .unspecified
            ? traitCollection.userInterfaceStyle
            : overrideUserInterfaceStyle
        return style == .light ? .darkContent : .lightContent
    }

    @available(iOS 26.0, *)
    private func presentNativeConfirmation(
        action: String,
        title: String,
        message: String,
        confirmTitle: String
    ) {
        guard presentedViewController == nil else { return }

        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "取消", style: .cancel))
        alert.addAction(UIAlertAction(title: confirmTitle, style: .destructive) { [weak self] _ in
            self?.dispatchWebEvent(
                name: "native-liquid-glass-confirmation",
                detail: ["action": action]
            )
        })
        present(alert, animated: true)
    }

    @available(iOS 26.0, *)
    private func showNativeToast(_ message: String, tone: String) {
        nativeToastView?.removeFromSuperview()

        var configuration = UIButton.Configuration.glass()
        configuration.title = message
        let symbolName: String
        switch tone {
        case "error": symbolName = "exclamationmark.circle.fill"
        case "info": symbolName = "info.circle.fill"
        default: symbolName = "checkmark.circle.fill"
        }
        configuration.image = UIImage(systemName: symbolName)
        configuration.imagePadding = 7
        // 使用动态标签色：浅色模式为黑色，暗色模式为白色。
        configuration.baseForegroundColor = .label
        configuration.contentInsets = NSDirectionalEdgeInsets(
            top: 11,
            leading: 18,
            bottom: 11,
            trailing: 18
        )

        let toast = UIButton(configuration: configuration)
        toast.translatesAutoresizingMaskIntoConstraints = false
        toast.isUserInteractionEnabled = false
        toast.cornerConfiguration = .capsule()
        toast.layer.zPosition = 1_000
        toast.alpha = 0
        toast.transform = CGAffineTransform(translationX: 0, y: -10).scaledBy(x: 0.96, y: 0.96)
        view.addSubview(toast)
        nativeToastView = toast

        NSLayoutConstraint.activate([
            toast.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            toast.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            toast.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
        view.bringSubviewToFront(toast)

        UIView.animate(
            withDuration: 0.22,
            delay: 0,
            options: [.beginFromCurrentState, .allowUserInteraction]
        ) {
            toast.alpha = 1
            toast.transform = .identity
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) { [weak self, weak toast] in
            guard let toast, self?.nativeToastView === toast else { return }
            UIView.animate(withDuration: 0.2, animations: {
                toast.alpha = 0
                toast.transform = CGAffineTransform(translationX: 0, y: -8)
            }, completion: { _ in
                toast.removeFromSuperview()
            })
        }
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == messageHandlerName,
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        switch type {
        case "route":
            if #available(iOS 26.0, *), let path = body["path"] as? String {
                updateRoute(path)
            }
        case "startup":
            webStartupReady = body["ready"] as? Bool ?? false
            if webStartupReady {
                updateTheme(pendingTheme, updateSurfaces: true)
            }
            setNeedsStatusBarAppearanceUpdate()
            if #available(iOS 26.0, *) {
                updateNativeControlVisibility()
            }
        case "startupContentPainted":
            revealStartupContent()
        case "overlay":
            webOverlayVisible = body["visible"] as? Bool ?? false
            if #available(iOS 26.0, *) {
                updateNativeControlVisibility()
            }
        case "theme":
            pendingTheme = body["theme"] as? String ?? "system"
            // trait 立即使用最终主题；承载层背景在开屏结束前仍固定暗色。
            updateTheme(pendingTheme, updateSurfaces: webStartupReady)
        case "confirm":
            guard #available(iOS 26.0, *) else { return }
            guard let action = body["action"] as? String,
                  let title = body["title"] as? String,
                  let confirmationMessage = body["message"] as? String,
                  let confirmTitle = body["confirmTitle"] as? String else { return }
            presentNativeConfirmation(
                action: action,
                title: title,
                message: confirmationMessage,
                confirmTitle: confirmTitle
            )
        case "toast":
            guard #available(iOS 26.0, *) else { return }
            if let toastMessage = body["message"] as? String {
                showNativeToast(toastMessage, tone: body["tone"] as? String ?? "success")
            }
        default:
            break
        }
    }
}

private extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
