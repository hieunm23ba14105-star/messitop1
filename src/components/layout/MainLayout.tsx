import { useEffect, useMemo, useRef, useState } from "react"
import {
  Download,
  Eye,
  EyeOff,
  Image,
  MessagesSquare,
  Minus,
  Plus,
  ScreenShare,
  SlidersHorizontal,
  SquareStack,
  Users,
} from "lucide-react"
import { layoutConfigs } from "@/constants/layouts"
import { sizePresets, type SizePreset } from "@/constants/exportPresets"
import { useConversationStore } from "@/store/conversationStore"
import { ChatLayout } from "@/components/layout/ChatLayout"
import { Toolbar } from "@/components/layout/Toolbar"
import { ParticipantManager } from "@/components/editor/ParticipantManager"
import { ConversationBuilder } from "@/components/editor/ConversationBuilder"
import { ExportPanel } from "@/components/export/ExportPanel"
import { SettingsPanel } from "@/components/layout/SettingsPanel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { LayoutSelector } from "@/components/layout/LayoutSelector"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/utils/cn"
import { clamp } from "@/utils/helpers"
import { exportNodeToImageSequence } from "@/utils/export"

const buildDownloadName = (format: "png" | "jpeg", index?: number) => {
  const extension = format === "jpeg" ? "jpg" : "png"
  if (index === undefined) {
    return `chat-export.${extension}`
  }
  return `chat-export-${String(index + 1).padStart(2, "0")}.${extension}`
}

export const MainLayout = () => {
  const exportRef = useRef<HTMLDivElement | null>(null)
  const fullExportRef = useRef<HTMLDivElement | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const previewConversationRef = useRef<HTMLDivElement | null>(null)
  const previewConversationContentRef = useRef<HTMLDivElement | null>(null)
  const [fitScale, setFitScale] = useState(1)
  const conversation = useConversationStore((state) => state.conversation)
  const layoutId = useConversationStore((state) => state.layoutId)
  const themeId = useConversationStore((state) => state.themeId)
  const activeParticipantId = useConversationStore((state) => state.activeParticipantId)
  const backgroundImageUrl = useConversationStore((state) => state.backgroundImageUrl)
  const backgroundImageOpacity = useConversationStore((state) => state.backgroundImageOpacity)
  const backgroundColor = useConversationStore((state) => state.backgroundColor)
  const ui = useConversationStore((state) => state.ui)
  const previousActivePanelRef = useRef(ui.activePanel)
  const setUi = useConversationStore((state) => state.setUi)
  const exportSettings = useConversationStore((state) => state.exportSettings)
  const setExportSettings = useConversationStore((state) => state.setExportSettings)
  const setTheme = useConversationStore((state) => state.setTheme)
  const [isQuickExporting, setIsQuickExporting] = useState(false)
  const [quickPreviewUrls, setQuickPreviewUrls] = useState<string[]>([])
  const [quickPreviewError, setQuickPreviewError] = useState<string | null>(null)
  const [isQuickPreviewing, setIsQuickPreviewing] = useState(false)
  const [isQuickPreviewOpen, setIsQuickPreviewOpen] = useState(false)
  const [conversationMetrics, setConversationMetrics] = useState({
    contentHeight: 0,
    viewportHeight: 0,
    fullExportHeight: 0,
    hasOverflow: false,
  })

  const handleQuickExport = async (mode: "download" | "preview") => {
    const target = exportSettings.captureMode === "full" ? fullExportRef.current : exportRef.current
    if (!target) return
    if (mode === "preview") {
      setQuickPreviewUrls([])
      setQuickPreviewError(null)
      setIsQuickPreviewing(true)
      setIsQuickPreviewOpen(true)
    }
    setIsQuickExporting(true)
    try {
      const renderOptions =
        exportSettings.captureMode === "screens"
          ? screenScrollTops.map((top) => ({
              scrollRootOverrides: [{ top }],
            }))
          : [
              {
                offset: exportSettings.captureMode === "full" ? undefined : getPreviewOffset(),
              },
            ]
      const dataUrls = await exportNodeToImageSequence(target, resolvedExportSettings, renderOptions)
      if (mode === "preview") {
        setQuickPreviewUrls(dataUrls)
        return
      }
      dataUrls.forEach((dataUrl, index) => {
        const link = document.createElement("a")
        link.href = dataUrl
        link.download =
          exportSettings.captureMode === "screens"
            ? buildDownloadName(exportSettings.format, index)
            : buildDownloadName(exportSettings.format)
        link.click()
      })
    } catch (error) {
      console.error("Quick export failed", error)
      if (mode === "preview") {
        const message = error instanceof Error ? error.message : "Lỗi không xác định"
        setQuickPreviewError(message)
      }
    } finally {
      setIsQuickExporting(false)
      if (mode === "preview") {
        setIsQuickPreviewing(false)
      }
    }
  }

  const layout = layoutConfigs.find((item) => item.id === layoutId) ?? layoutConfigs[0]
  const theme = useMemo(
    () => layout.themes.find((item) => item.id === themeId) ?? layout.themes[0],
    [layout, themeId],
  )
  const hasDark = layout.themes.some((themeEntry) => themeEntry.id === "dark")
  const isDark = themeId === "dark"

  useEffect(() => {
    if (typeof window === "undefined") return
    const isSmall = window.matchMedia("(max-width: 1023px)").matches
    if (isSmall) {
      setUi({ activeView: "preview", isSidebarOpen: false })
    }
  }, [setUi])

  useEffect(() => {
    const element = previewContainerRef.current
    if (!element) return

    const updateScale = () => {
      const rect = element.getBoundingClientRect()
      const styles = window.getComputedStyle(element)
      const paddingX =
        parseFloat(styles.paddingLeft || "0") + parseFloat(styles.paddingRight || "0")
      const paddingY =
        parseFloat(styles.paddingTop || "0") + parseFloat(styles.paddingBottom || "0")
      const width = rect.width - paddingX
      const height = rect.height - paddingY
      if (!width || !height) return
      const scaleX = width / exportSettings.width
      const scaleY = height / exportSettings.height
      const nextScale = Math.min(scaleX, scaleY, 1)
      setFitScale(nextScale > 0 ? nextScale : 1)
    }

    const raf = requestAnimationFrame(updateScale)
    const observer = new ResizeObserver(() => requestAnimationFrame(updateScale))
    observer.observe(element)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [exportSettings.width, exportSettings.height, ui.activeView, ui.autoFit])

  useEffect(() => {
    if (previousActivePanelRef.current !== ui.activePanel && (ui.activeView === "preview" || !ui.isSidebarOpen)) {
      setUi({ activeView: "editor", isSidebarOpen: true })
    }
    previousActivePanelRef.current = ui.activePanel
  }, [setUi, ui.activePanel, ui.activeView, ui.isSidebarOpen])

  useEffect(() => {
    const container = previewConversationRef.current
    const content = previewConversationContentRef.current
    const exportElement = exportRef.current
    if (!container || !content || !exportElement) return

    let frame = 0
    const measureConversation = () => {
      frame = 0
      const viewportHeight = container.clientHeight
      if (!viewportHeight) return
      const contentHeight = Math.ceil(Math.max(content.scrollHeight, content.offsetHeight))
      const chromeHeight = Math.max(0, exportElement.clientHeight - viewportHeight)
      const fullExportHeight = Math.max(exportSettings.height, Math.ceil(chromeHeight + contentHeight))
      const hasOverflow = contentHeight > viewportHeight + 1
      setConversationMetrics((previous) => {
        if (
          previous.contentHeight === contentHeight &&
          previous.viewportHeight === viewportHeight &&
          previous.fullExportHeight === fullExportHeight &&
          previous.hasOverflow === hasOverflow
        ) {
          return previous
        }
        return {
          contentHeight,
          viewportHeight,
          fullExportHeight,
          hasOverflow,
        }
      })
    }
    const scheduleMeasure = () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      frame = requestAnimationFrame(measureConversation)
    }

    scheduleMeasure()

    const observer = new ResizeObserver(scheduleMeasure)
    observer.observe(container)
    observer.observe(content)
    observer.observe(exportElement)

    const images = Array.from(content.querySelectorAll("img"))
    images.forEach((image) => {
      image.addEventListener("load", scheduleMeasure)
      image.addEventListener("error", scheduleMeasure)
    })

    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      observer.disconnect()
      images.forEach((image) => {
        image.removeEventListener("load", scheduleMeasure)
        image.removeEventListener("error", scheduleMeasure)
      })
    }
  }, [conversation, exportSettings.height, layout.id, theme.id, ui.showChrome])

  const appliedScale = clamp((ui.autoFit ? fitScale : 1) * ui.zoom, 0.1, 2)
  const scaledWidth = exportSettings.width * appliedScale
  const scaledHeight = exportSettings.height * appliedScale
  const visibleMessageCount = conversation.messages.filter((message) => !message.isHidden).length
  const resolvedExportHeight =
    exportSettings.captureMode === "full"
      ? Math.max(conversationMetrics.fullExportHeight, exportSettings.height)
      : exportSettings.height
  const resolvedExportSettings = useMemo(
    () => ({
      ...exportSettings,
      height: resolvedExportHeight,
    }),
    [exportSettings, resolvedExportHeight],
  )
  const screenScrollTops = useMemo(() => {
    const viewportHeight = Math.round(conversationMetrics.viewportHeight)
    const contentHeight = Math.round(conversationMetrics.contentHeight)
    if (!viewportHeight || !contentHeight) {
      return [0]
    }

    const maxScroll = Math.max(0, contentHeight - viewportHeight)
    if (maxScroll === 0) {
      return [0]
    }

    const positions: number[] = []
    for (let top = 0; top < maxScroll; top += viewportHeight) {
      positions.push(top)
    }
    if (positions[positions.length - 1] !== maxScroll) {
      positions.push(maxScroll)
    }
    return positions
  }, [conversationMetrics.contentHeight, conversationMetrics.viewportHeight])
  const screenCount = Math.max(screenScrollTops.length, 1)
  const getPreviewOffset = () => {
    const scrollElement = previewScrollRef.current
    const exportElement = exportRef.current
    if (!scrollElement || !exportElement || appliedScale === 0) {
      return { x: 0, y: 0 }
    }
    const scrollRect = scrollElement.getBoundingClientRect()
    const exportRect = exportElement.getBoundingClientRect()
    const deltaX = scrollRect.left - exportRect.left
    const deltaY = scrollRect.top - exportRect.top
    const rawX = deltaX / appliedScale
    const rawY = deltaY / appliedScale
    const viewWidth = scrollElement.clientWidth / appliedScale
    const viewHeight = scrollElement.clientHeight / appliedScale
    const maxX = Math.max(0, exportSettings.width - viewWidth)
    const maxY = Math.max(0, exportSettings.height - viewHeight)
    const offsetX = clamp(rawX, 0, maxX)
    const offsetY = clamp(rawY, 0, maxY)
    return {
      x: Number.isFinite(offsetX) ? offsetX : 0,
      y: Number.isFinite(offsetY) ? offsetY : 0,
    }
  }
  const scrollPreviewConversation = (position: "top" | "bottom") => {
    const container = previewConversationRef.current
    if (!container) return
    container.scrollTo({
      top: position === "top" ? 0 : container.scrollHeight,
      behavior: "smooth",
    })
  }

  const panelTabs = [
    {
      id: "participants",
      label: "Người tham gia",
      icon: Users,
      description: "Thêm người, avatar và trạng thái hiện diện.",
      meta: `${conversation.participants.length} người`,
    },
    {
      id: "messages",
      label: "Messages",
      icon: MessagesSquare,
      description: "Soạn nội dung, sắp xếp lại và chỉnh thời gian hội thoại.",
      meta: `${conversation.messages.length} tin nhắn`,
    },
    {
      id: "settings",
      label: "Giao diện",
      icon: SlidersHorizontal,
      description: "Chọn bố cục, giao diện màu và nền.",
      meta: `${layout.name} ${theme.name}`,
    },
    {
      id: "export",
      label: "Xuất ảnh",
      icon: Download,
      description: "Thiết lập kích thước, định dạng và tải ảnh.",
      meta: `${exportSettings.width} x ${exportSettings.height}`,
    },
  ] as const
  const activePanelIndex = panelTabs.findIndex((tab) => tab.id === ui.activePanel)
  const resolvedActivePanelIndex = activePanelIndex === -1 ? 0 : activePanelIndex
  const activePanel = panelTabs[resolvedActivePanelIndex] ?? panelTabs[0]

  const quickPresetIds = new Set(["iphone-14-pro", "ipad", "desktop"])
  const quickPresets: SizePreset[] = sizePresets.filter((preset) => quickPresetIds.has(preset.id))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      <div className="mx-auto flex flex-col gap-6 px-4 pt-6 pb-24 lg:pb-6">
        <Toolbar />

        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Quy trình
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Bước {resolvedActivePanelIndex + 1}/{panelTabs.length}: {activePanel.label}
                </div>
                <p className="text-xs text-slate-500">{activePanel.description}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {panelTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = ui.activePanel === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setUi({ activePanel: tab.id, activeView: "editor", isSidebarOpen: true })
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition",
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold",
                        isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <aside
            className={cn(
              "space-y-6",
              ui.isSidebarOpen && ui.activeView !== "preview" ? "block" : "hidden",
            )}
          >
            <Card>
              <CardContent className="space-y-6">
                {ui.activePanel === "participants" ? <ParticipantManager /> : null}
                {ui.activePanel === "messages" ? <ConversationBuilder /> : null}
                {ui.activePanel === "settings" ? <SettingsPanel /> : null}
                {ui.activePanel === "export" ? (
                  <ExportPanel
                    targetRef={exportSettings.captureMode === "full" ? fullExportRef : exportRef}
                    getExportOffset={
                      exportSettings.captureMode === "full" ? undefined : getPreviewOffset
                    }
                    resolvedHeight={resolvedExportHeight}
                    screenScrollTops={screenScrollTops}
                  />
                ) : null}
              </CardContent>
            </Card>
          </aside>

          <main className={cn("space-y-4", ui.activeView === "editor" && "hidden lg:block")}>
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Khung xem trước</div>
                    <p className="text-xs text-slate-500">Xem trực tiếp bố cục và luồng tin nhắn.</p>
                  </div>
                  <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUi({ showChrome: !ui.showChrome })}
                    >
                      {ui.showChrome ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      <span className="hidden sm:inline">
                        {ui.showChrome ? "Ẩn khung máy" : "Hiện khung máy"}
                      </span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUi({ zoom: clamp(ui.zoom - 0.1, 0.5, 2) })}
                    >
                      <Minus className="h-4 w-4" />
                      <span className="hidden sm:inline">Thu nhỏ</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUi({ zoom: clamp(ui.zoom + 0.1, 0.5, 2) })}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Phóng to</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setUi({ zoom: 1 })}>
                      <ScreenShare className="h-4 w-4" />
                      <span className="hidden sm:inline">Đặt lại</span>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <SquareStack className="h-4 w-4" />
                  Thu phóng {Math.round(appliedScale * 100)}%
                  {ui.autoFit ? " (tự căn)" : ""} - Kích thước xuất {exportSettings.width} x{" "}
                  {resolvedExportHeight}
                  {exportSettings.captureMode === "full" ? " - toàn bộ tin nhắn" : ""}
                </div>
                {conversationMetrics.hasOverflow ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="font-semibold">
                        Đoạn chat dài: {visibleMessageCount} tin nhắn đang hiển thị
                      </div>
                      <p className="text-amber-900/80">
                        Cuộn trong phần xem trước để duyệt đoạn chat, hoặc nhảy nhanh tới đầu
                        hay tin nhắn mới nhất.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => scrollPreviewConversation("top")}
                      >
                        Lên đầu
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => scrollPreviewConversation("bottom")}
                      >
                        Tới mới nhất
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                <div
                  ref={previewContainerRef}
                  className="flex h-[60vh] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 lg:h-[70vh]"
                >
                  <div
                    ref={previewScrollRef}
                    className="hide-scrollbar flex h-full w-full items-start justify-start overflow-auto"
                  >
                    <div
                      className="relative m-auto"
                      style={{
                        width: scaledWidth,
                        height: scaledHeight,
                      }}
                    >
                      <div
                        className="absolute left-0 top-0"
                        style={{
                          width: exportSettings.width,
                          height: exportSettings.height,
                          transform: `scale(${appliedScale})`,
                          transformOrigin: "top left",
                        }}
                      >
                        <div
                          ref={exportRef}
                          className="h-full w-full"
                          style={{ width: exportSettings.width, height: exportSettings.height }}
                        >
                          <ChatLayout
                            conversation={conversation}
                            layout={layout}
                            theme={theme}
                            showChrome={ui.showChrome}
                            activeParticipantId={activeParticipantId}
                            backgroundImageUrl={backgroundImageUrl}
                            backgroundImageOpacity={backgroundImageOpacity}
                            backgroundColor={backgroundColor}
                            conversationMode="scroll"
                            conversationContainerRef={previewConversationRef}
                            conversationContentRef={previewConversationContentRef}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Bố cục
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="w-full sm:w-auto">
                        <LayoutSelector />
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-full bg-slate-100 px-3 py-1 sm:justify-start">
                        <span className="text-xs font-semibold text-slate-600">Giao diện màu</span>
                        <Switch
                          checked={isDark}
                          onCheckedChange={(value) => setTheme(value && hasDark ? "dark" : "light")}
                          disabled={!hasDark}
                        />
                        <span className="text-xs text-slate-500">{isDark ? "Tối" : "Sáng"}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setUi({ activePanel: "settings", activeView: "editor", isSidebarOpen: true })
                    }
                  >
                    Thêm tuỳ chỉnh
                  </Button>
                </div>
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Tải nhanh
                    </div>
                    <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0">
                      {quickPresets.map((preset) => (
                        <Button
                          key={preset.id}
                          variant={exportSettings.presetId === preset.id ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setExportSettings({
                              presetId: preset.id,
                              width: preset.width,
                              height: preset.height,
                            })
                          }
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Phạm vi chụp
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={exportSettings.captureMode === "viewport" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setExportSettings({ captureMode: "viewport" })}
                        >
                          Khung nhìn hiện tại
                        </Button>
                        <Button
                          variant={exportSettings.captureMode === "full" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setExportSettings({ captureMode: "full" })}
                        >
                          Toàn bộ tin nhắn
                        </Button>
                        <Button
                          variant={exportSettings.captureMode === "screens" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setExportSettings({ captureMode: "screens" })}
                        >
                          {screenCount} màn hình
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">
                        {exportSettings.captureMode === "full"
                          ? `Xuất toàn bộ tin nhắn hiển thị trong ảnh ${exportSettings.width} x ${resolvedExportHeight}px.`
                          : exportSettings.captureMode === "screens"
                            ? `Chia đoạn chat thành ${screenCount} ảnh chụp thiết bị liên tiếp theo kích thước hiện tại.`
                            : "Xuất chính xác khung thiết bị như trong phần xem trước."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 3].map((scale) => (
                      <Button
                        key={scale}
                        variant={exportSettings.scale === scale ? "default" : "outline"}
                        size="sm"
                        onClick={() => setExportSettings({ scale })}
                      >
                        {scale}x
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2"
                      disabled={isQuickExporting}
                      onClick={() => handleQuickExport("preview")}
                    >
                      <Image className="h-4 w-4" />
                      Xem trước
                    </Button>
                    <Button
                      size="lg"
                      className="gap-2"
                      disabled={isQuickExporting}
                      onClick={() => handleQuickExport("download")}
                    >
                      <Download className="h-4 w-4" />
                      Tải xuống
                    </Button>
                  </div>
                </div>
                <Dialog
                  open={isQuickPreviewOpen}
                  onOpenChange={(open) => {
                    setIsQuickPreviewOpen(open)
                    if (!open) {
                      setQuickPreviewUrls([])
                      setQuickPreviewError(null)
                      setIsQuickPreviewing(false)
                    }
                  }}
                >
                  <DialogContent className="w-[94vw] max-w-5xl max-h-[88vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Xem trước ảnh xuất</DialogTitle>
                      <DialogDescription>
                        {resolvedExportSettings.width} x {resolvedExportSettings.height} -{" "}
                        {resolvedExportSettings.scale}x -{" "}
                        {resolvedExportSettings.format.toUpperCase()} -{" "}
                        {exportSettings.captureMode === "full"
                          ? "Toàn bộ tin nhắn"
                          : exportSettings.captureMode === "screens"
                            ? `${screenCount} màn hình liên tiếp`
                            : "Khung nhìn hiện tại"}
                      </DialogDescription>
                    </DialogHeader>
                    {isQuickPreviewing ? (
                      <div className="text-sm text-slate-500">Đang dựng ảnh xem trước...</div>
                    ) : null}
                    {quickPreviewError ? (
                      <div className="text-sm text-red-600">Xuất ảnh thất bại: {quickPreviewError}</div>
                    ) : null}
                    {quickPreviewUrls.length ? (
                      <div className="space-y-3">
                        {quickPreviewUrls.map((quickPreviewUrl, index) => (
                          <div key={quickPreviewUrl} className="space-y-2">
                            {quickPreviewUrls.length > 1 ? (
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Màn hình {index + 1}
                              </div>
                            ) : null}
                            <img
                              src={quickPreviewUrl}
                              alt={
                                quickPreviewUrls.length > 1
                                  ? `Xem trước tải nhanh màn hình ${index + 1}`
                                  : "Xem trước tải nhanh"
                              }
                              className="max-h-[70vh] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
                            />
                          </div>
                        ))}
                        <div className="text-xs text-slate-500">
                          {quickPreviewUrls.length > 1
                            ? "Tải xuống sẽ lưu từng tệp theo đúng thứ tự màn hình."
                            : "Nhấp chuột phải vào ảnh để lưu."}
                        </div>
                      </div>
                    ) : null}
                  </DialogContent>
                </Dialog>
                {exportSettings.captureMode === "full" ? (
                  <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
                    <div
                      ref={fullExportRef}
                      className="h-full w-full"
                      style={{ width: exportSettings.width, height: resolvedExportHeight }}
                    >
                      <ChatLayout
                        conversation={conversation}
                        layout={layout}
                        theme={theme}
                        showChrome={ui.showChrome}
                        activeParticipantId={activeParticipantId}
                        backgroundImageUrl={backgroundImageUrl}
                        backgroundImageOpacity={backgroundImageOpacity}
                        backgroundColor={backgroundColor}
                        conversationMode="expanded"
                      />
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </main>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://github.com/quead/chat-message-simulator"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                Điều khoản và điều kiện
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Điều khoản và điều kiện</DialogTitle>
                <DialogDescription>
                  Khi sử dụng ứng dụng này, bạn đồng ý với các điều khoản bên dưới.
                </DialogDescription>
                <div className="text-xs text-slate-500">Cập nhật lần cuối: 2026-01-03 | Phiên bản: 2026-01-03</div>
              </DialogHeader>
              <div className="space-y-4 text-sm text-slate-600">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Ứng dụng này làm gì</div>
                  <p>
                    Ứng dụng cho phép bạn tạo mô phỏng đoạn chat, xem trước bố cục và xuất ảnh.
                    Mọi xử lý đều diễn ra trong trình duyệt của bạn.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Xử lý dữ liệu và GDPR</div>
                  <p>
                    Chúng tôi không thu thập, lưu trữ hoặc xử lý dữ liệu cá nhân trên máy chủ.
                    Các chỉnh sửa và tự động lưu của bạn nằm trong bộ nhớ cục bộ của trình duyệt.
                    Bạn có thể xoá chúng bằng nút Xoá hoặc xoá dữ liệu trang trong trình duyệt.
                  </p>
                  <p>
                    Chúng tôi không chạy phân tích theo dõi hoặc cookie theo dõi. Vì nội dung của
                    bạn không rời khỏi thiết bị, nên không có bên xử lý dữ liệu phía máy chủ cho
                    nội dung đó. Nếu bạn liên hệ, email của bạn chỉ được dùng để phản hồi.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Tài nguyên bên thứ ba</div>
                  <p>
                    Ứng dụng có thể tải phông chữ hoặc ảnh từ xa do người dùng cung cấp qua dịch vụ
                    bên thứ ba. Các nhà cung cấp đó có thể nhận dữ liệu yêu cầu tiêu chuẩn như địa
                    chỉ IP và user-agent. Bạn có thể thay thế tài nguyên hoặc chặn yêu cầu mạng khi cần.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Nội dung của bạn</div>
                  <p>
                    Bạn chịu trách nhiệm với nội dung đã nhập và xuất. Không nên đưa dữ liệu nhạy
                    cảm nếu bạn không muốn lưu nó cục bộ. Chỉ sử dụng nội dung và tài nguyên mà
                    bạn có quyền sử dụng.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Miễn trừ bảo đảm</div>
                  <p>
                    Ứng dụng được cung cấp theo trạng thái &quot;nguyên bản&quot; và &quot;sẵn có&quot;,
                    không có bất kỳ bảo đảm rõ ràng hay ngụ ý nào, bao gồm độ chính xác, độ tin cậy,
                    tính sẵn sàng hoặc mức độ phù hợp cho mục đích cụ thể. Bạn tự chịu rủi ro khi sử dụng.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Giới hạn trách nhiệm</div>
                  <p>
                    Trong phạm vi tối đa pháp luật cho phép, chúng tôi không chịu trách nhiệm với
                    bất kỳ thiệt hại gián tiếp, ngẫu nhiên, đặc biệt, hệ quả hoặc mang tính trừng phạt,
                    cũng như mất dữ liệu, lợi nhuận hoặc gián đoạn kinh doanh. Tổng trách nhiệm của
                    chúng tôi bị giới hạn ở số tiền bạn đã trả cho ứng dụng, tức là bằng 0.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Luật điều chỉnh</div>
                  <p>
                    Các điều khoản này được điều chỉnh theo pháp luật Romania. Mọi tranh chấp thuộc
                    thẩm quyền xét xử riêng của toà án tại Romania.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Liên hệ</div>
                  <p>
                    Có câu hỏi về điều khoản hoặc GDPR? Email: queadx@gmail.com
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Thay đổi</div>
                  <p>
                    Chúng tôi có thể cập nhật điều khoản theo thời gian. Việc tiếp tục sử dụng đồng
                    nghĩa bạn chấp nhận phiên bản điều khoản đã được cập nhật.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                Chính sách quyền riêng tư
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Chính sách quyền riêng tư</DialogTitle>
                <DialogDescription>
                  Chính sách này giải thích cách dữ liệu được xử lý trong ứng dụng.
                </DialogDescription>
                <div className="text-xs text-slate-500">Cập nhật lần cuối: 2026-01-03 | Phiên bản: 2026-01-03</div>
              </DialogHeader>
              <div className="space-y-4 text-sm text-slate-600">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Dữ liệu chúng tôi thu thập</div>
                  <p>
                    Chúng tôi không thu thập hoặc lưu nội dung chat của bạn trên máy chủ. Mọi thứ
                    bạn tạo đều ở lại trên thiết bị của bạn.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Lưu trữ cục bộ</div>
                  <p>
                    Ứng dụng dùng bộ nhớ cục bộ của trình duyệt để lưu tự động và cài đặt. Bạn có thể
                    xoá dữ liệu này bằng nút Xoá hoặc xoá dữ liệu trang trong trình duyệt.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Yêu cầu đến bên thứ ba</div>
                  <p>
                    Phông chữ và ảnh từ xa do người dùng cung cấp có thể được tải từ dịch vụ bên
                    thứ ba. Các bên đó có thể nhận dữ liệu yêu cầu tiêu chuẩn như địa chỉ IP và
                    user-agent. Bạn có thể chặn hoặc thay thế những tài nguyên này khi cần.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Tuân thủ GDPR</div>
                  <p>
                    Vì nội dung của bạn không rời khỏi thiết bị, ứng dụng không xử lý dữ liệu cá
                    nhân ở phía máy chủ. Nếu bạn liên hệ, email của bạn chỉ được dùng để phản hồi
                    và không được chia sẻ.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Liên hệ</div>
                  <p>
                    Câu hỏi về quyền riêng tư? Email: queadx@gmail.com
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Thay đổi</div>
                  <p>
                    Chúng tôi có thể cập nhật chính sách này theo thời gian. Việc tiếp tục sử dụng
                    đồng nghĩa bạn chấp nhận phiên bản chính sách đã cập nhật.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 lg:hidden">
        <div className="rounded-[1.4rem] border border-white/70 bg-white/90 p-1 shadow-lg backdrop-blur">
          <div
            role="tablist"
            aria-label="Chế độ xem trên di động"
            className="relative grid min-w-[188px] grid-cols-2 items-center"
          >
            <div
              aria-hidden="true"
              className={cn(
                "absolute inset-y-0 left-0 w-1/2 rounded-[1.1rem] bg-slate-900 shadow-sm transition-transform duration-200 ease-out",
                ui.activeView === "preview" && "translate-x-full",
              )}
            />
            <button
              type="button"
              role="tab"
              aria-selected={ui.activeView === "editor"}
              className={cn(
                "relative z-10 rounded-[1.1rem] px-5 py-2 text-sm font-semibold transition-colors",
                ui.activeView === "editor" ? "text-white" : "text-slate-500",
              )}
              onClick={() =>
                setUi({
                  activeView: "editor",
                  isSidebarOpen: true,
                })
              }
            >
              Sửa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ui.activeView === "preview"}
              className={cn(
                "relative z-10 rounded-[1.1rem] px-5 py-2 text-sm font-semibold transition-colors",
                ui.activeView === "preview" ? "text-white" : "text-slate-500",
              )}
              onClick={() =>
                setUi({
                  activeView: "preview",
                  isSidebarOpen: false,
                })
              }
            >
              Xem
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
