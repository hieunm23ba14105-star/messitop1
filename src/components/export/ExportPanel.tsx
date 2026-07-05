import { useMemo, useState } from "react"
import { Copy, Download, Image, Loader2, StretchHorizontal, StretchVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SizePresets } from "@/components/export/SizePresets"
import { sizePresets } from "@/constants/exportPresets"
import { exportNodeToImageSequence } from "@/utils/export"
import { useConversationStore } from "@/store/conversationStore"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ExportPanelProps {
  targetRef: React.RefObject<HTMLDivElement | null> | React.RefObject<HTMLDivElement>
  getExportOffset?: () => { x: number; y: number }
  resolvedHeight?: number
  screenScrollTops?: number[]
}

const buildDownloadName = (format: "png" | "jpeg", index?: number) => {
  const extension = format === "jpeg" ? "jpg" : "png"
  if (index === undefined) {
    return `chat-export.${extension}`
  }
  return `chat-export-${String(index + 1).padStart(2, "0")}.${extension}`
}

export const ExportPanel = ({
  targetRef,
  getExportOffset,
  resolvedHeight,
  screenScrollTops = [0],
}: ExportPanelProps) => {
  const exportSettings = useConversationStore((state) => state.exportSettings)
  const setExportSettings = useConversationStore((state) => state.setExportSettings)
  const [isExporting, setIsExporting] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(true)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const effectiveHeight =
    exportSettings.captureMode === "full"
      ? Math.max(resolvedHeight ?? exportSettings.height, exportSettings.height)
      : exportSettings.height
  const effectiveExportSettings = {
    ...exportSettings,
    height: effectiveHeight,
  }

  const preset = useMemo(
    () => sizePresets.find((item) => item.id === exportSettings.presetId),
    [exportSettings.presetId],
  )
  const screenCount = Math.max(screenScrollTops.length, 1)

  const runExport = async (mode: "download" | "preview") => {
    if (!targetRef.current) return
    if (mode === "preview") {
      setPreviewUrls([])
      setPreviewError(null)
      setIsPreviewing(true)
      setIsPreviewOpen(true)
    }
    setIsExporting(true)
    try {
      const renderOptions =
        exportSettings.captureMode === "screens"
          ? screenScrollTops.map((top) => ({
              scrollRootOverrides: [{ top }],
            }))
          : [
              {
                offset: exportSettings.captureMode === "full" ? undefined : getExportOffset?.(),
              },
            ]
      const dataUrls = await exportNodeToImageSequence(
        targetRef.current,
        effectiveExportSettings,
        renderOptions,
      )
      if (mode === "preview") {
        setPreviewUrls(dataUrls)
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
      console.error("Export failed", error)
      if (mode === "preview") {
        const message = error instanceof Error ? error.message : "Lỗi không xác định"
        setPreviewError(message)
      }
    } finally {
      setIsExporting(false)
      if (mode === "preview") {
        setIsPreviewing(false)
      }
    }
  }

  const captureSummary =
    exportSettings.captureMode === "full"
      ? "Toàn bộ tin nhắn"
      : exportSettings.captureMode === "screens"
        ? `${screenCount} màn hình liên tiếp`
        : "Khung nhìn hiện tại"
  const settingsSummary = `${exportSettings.width} x ${effectiveHeight} - ${exportSettings.scale}x - ${exportSettings.format.toUpperCase()} - ${captureSummary}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Xuất ảnh</h3>
          <p className="text-xs text-slate-500">Chọn kích thước, định dạng và chất lượng trước khi xuất.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsSummaryOpen(!isSummaryOpen)}>
          {isSummaryOpen ? "Thu gọn" : "Mở rộng"}
        </Button>
      </div>

      {isSummaryOpen ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-slate-500" />
              <span>{settingsSummary}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigator.clipboard.writeText(settingsSummary)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <Label>Mẫu thiết bị</Label>
        <SizePresets
          selectedId={exportSettings.presetId}
          onSelect={(presetItem) =>
            setExportSettings({
              presetId: presetItem.id,
              width: presetItem.width,
              height: presetItem.height,
            })
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Chiều rộng tuỳ chỉnh</Label>
          <div className="relative">
            <StretchHorizontal className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              type="number"
              min={240}
              value={exportSettings.width}
              onChange={(event) =>
                setExportSettings({
                  presetId: "custom",
                  width: Number(event.target.value),
                })
              }
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Chiều cao tuỳ chỉnh</Label>
          <div className="relative">
            <StretchVertical className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              type="number"
              min={240}
              value={exportSettings.height}
              onChange={(event) =>
                setExportSettings({
                  presetId: "custom",
                  height: Number(event.target.value),
                })
              }
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Chất lượng</Label>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((scale) => (
            <Button
              key={scale}
              variant={exportSettings.scale === scale ? "default" : "outline"}
              onClick={() => setExportSettings({ scale })}
            >
              {scale}x
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Định dạng</Label>
        <div className="flex gap-2">
          <Button
            variant={exportSettings.format === "png" ? "default" : "outline"}
            onClick={() => setExportSettings({ format: "png" })}
          >
            PNG
          </Button>
          <Button
            variant={exportSettings.format === "jpeg" ? "default" : "outline"}
            onClick={() => setExportSettings({ format: "jpeg" })}
          >
            JPEG
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Phạm vi chụp</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={exportSettings.captureMode === "viewport" ? "default" : "outline"}
            onClick={() => setExportSettings({ captureMode: "viewport" })}
          >
            Khung nhìn hiện tại
          </Button>
          <Button
            variant={exportSettings.captureMode === "full" ? "default" : "outline"}
            onClick={() => setExportSettings({ captureMode: "full" })}
          >
            Toàn bộ tin nhắn
          </Button>
          <Button
            variant={exportSettings.captureMode === "screens" ? "default" : "outline"}
            onClick={() => setExportSettings({ captureMode: "screens" })}
          >
            Nhiều màn hình liên tiếp
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          {exportSettings.captureMode === "full"
            ? `Chiều cao sẽ tự mở rộng tới ${effectiveHeight}px để chứa toàn bộ tin nhắn đang hiển thị.`
            : exportSettings.captureMode === "screens"
              ? `Tự động chia đoạn chat thành ${screenCount} ảnh chụp theo kích thước thiết bị dựa trên chiều cao hiện tại.`
              : "Xuất chính xác phần đang hiển thị trong khung thiết bị."}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={() => runExport("preview")} disabled={isExporting}>
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
          Xem trước
        </Button>
        <Button onClick={() => runExport("download")} disabled={isExporting}>
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Tải xuống
        </Button>
      </div>

      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open)
          if (!open) {
            setPreviewUrls([])
            setPreviewError(null)
            setIsPreviewing(false)
          }
        }}
      >
        <DialogContent className="w-[94vw] max-w-5xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Xem trước ảnh xuất</DialogTitle>
            <DialogDescription>{settingsSummary}</DialogDescription>
          </DialogHeader>
          {isPreviewing ? (
            <div className="text-sm text-slate-500">Đang dựng ảnh xem trước...</div>
          ) : null}
          {previewError ? (
            <div className="text-sm text-red-600">Xuất ảnh thất bại: {previewError}</div>
          ) : null}
          {previewUrls.length ? (
            <div className="space-y-3">
              {previewUrls.map((previewUrl, index) => (
                <div key={previewUrl} className="space-y-2">
                  {previewUrls.length > 1 ? (
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Màn hình {index + 1}
                    </div>
                  ) : null}
                  <img
                    src={previewUrl}
                    alt={
                      previewUrls.length > 1
                        ? `Xem trước ảnh xuất màn hình ${index + 1}`
                        : "Xem trước ảnh xuất"
                    }
                    className="max-h-[70vh] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
                  />
                </div>
              ))}
              <div className="text-xs text-slate-500">
                {previewUrls.length > 1
                  ? "Tải xuống sẽ lưu từng ảnh theo đúng thứ tự màn hình."
                  : "Nhấp chuột phải vào ảnh để lưu."}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {preset ? (
        <p className="text-xs text-slate-500">
          Mẫu: {preset.label} - {preset.width} x {preset.height}
        </p>
      ) : (
        <p className="text-xs text-slate-500">Đang dùng kích thước tuỳ chỉnh.</p>
      )}
    </div>
  )
}
